# Runbook: srv-pitwall-01 production host

This runbook provisions the Pit Wall On-Call production host inside the existing homelab, following the homelab playbook's execution contract (P05 onwards): RUN IN / WORKING DIRECTORY / FILE / ACTION / VERIFY / EXPECTED / ERROR / STOP for every step. Secrets are verified by existence, length or permission, never printed.

The IaC lives in `homelab-infra` (Terraform root + Ansible). This repo only contains the app, the compose stack and `deploy.sh`.

## 1. State before, what gets created, what is not touched

**Before:** P01 to P05 are done. `srv-proxy-01` (192.168.18.14) serves rafifdzaky.com through Tunnel `portfolio-prod`. `srv-vpn-01` (192.168.18.18) advertises 192.168.18.0/24 to the tailnet. Terraform uses one root and one state at `C:\Users\Rafif\Downloads\homelab-infra\terraform`.

**Will create:**
- VM `srv-pitwall-01` at **192.168.18.25**: 2 cores, **1536 MB**, 16G disk, cloned from `ubuntu-template`
- Ansible role `pitwall_host` and playbook `pitwall.yml`: user `pitwall-deploy`, `/opt/pitwall`, and a managed secret block in `.env`
- Tailnet tag `tag:ci-pitwall` with a single grant: `tcp:22` to 192.168.18.25
- Tunnel **`pitwall-prod`** (separate from `portfolio-prod`) → `pitwall.rafifdzaky.com`
- GitHub environment `production`, repo secrets, and branch protection on `rafifdzaky27/pit-wall-on-call`

**Will NOT touch:** `srv-proxy-01`, Tunnel `portfolio-prod`, the portfolio Caddy config, the DNS VMs, `srv-vpn-01`'s configuration, router port-forwards (none are added), or any existing Terraform resource.

## 2. Dependency graph

```
P01 Terraform root + ubuntu-template ──► Step 2 VM
P02 Ansible controller + roles common, docker ──► Steps 3–4, 7
P03 Tailscale subnet router (srv-vpn-01) ──► Step 5 CI reaches .25:22
Cloudflare zone rafifdzaky.com (NS on Cloudflare, verified) ──► Step 6 Tunnel
pit-wall-on-call CI (images in GHCR) ──► Step 9 first deploy
```
- The subnet router is required because CI runners join the tailnet as `tag:ci-pitwall` and reach the VM's LAN IP. The VM itself runs no Tailscale, the same pattern as the portfolio.
- Caddy on `srv-proxy-01` is **not** a dependency. The app's own Caddy runs inside the compose stack.

## 3. Exposure and trust boundaries

| Surface | Exposure | Notes |
|---|---|---|
| `https://pitwall.rafifdzaky.com` | **PUBLIC** | Cloudflare edge → Tunnel `pitwall-prod` (outbound) → `web:80` on the compose network |
| SSH :22 on 192.168.18.25 | **INTERNAL** (LAN, plus the tailnet via the subnet route) | `devops` (admin key) and `pitwall-deploy` (CI key, `restrict`) |
| api :8787, postgres :5432, `/healthz`, `/readyz` | Compose network only | No host ports are published in production |

`pitwall-deploy` is in the `docker` group, which makes it **root-equivalent on this VM**. That is accepted because the VM is single-purpose. Unlike `portfolio-deploy`, it cannot be restricted to a directory. Future hardening: an SSH forced command.

## 4. Resources (runtime vs build)

| | RAM | Disk |
|---|---|---|
| OS + Docker | ~300 MB | ~4 GB |
| postgres 17 (small data) | 60–150 MB | < 1 GB |
| api (Node 22) | ~70 MB | image ~160 MB |
| web (Caddy) + cloudflared | ~50 MB | ~110 MB |
| umami (from M5) | ~200 MB | ~300 MB |
| **Runtime total** | **~0.7–0.8 GB of 1.5 GB** | Logs are capped at 30 MB per service |

**Build RAM on this VM: 0.** Images are built on GitHub runners.

RAM tier: always-on (+1.5 GB). Add `srv-pitwall-01` to the "pause during the k3s lab" list if memory pressure appears.

---

## Step 0: Commit the homelab-infra baseline

**RUN IN:** [Windows PowerShell]
**WORKING DIRECTORY:** `C:\Users\Rafif\Downloads\homelab-infra`
**ACTION:** commit the P02–P05 work (`ansible/`, `terraform/p05-jellyfin.tf`, `terraform/main.tf`) so the Pit Wall change becomes its own reviewable diff.

```powershell
git status --short
git diff --stat
git add ansible terraform/main.tf terraform/p05-jellyfin.tf
git status --short
```
**VERIFY:** the staged list contains only `ansible/**`, `terraform/main.tf` and `terraform/p05-jellyfin.tf`.
**EXPECTED:** no `*.tfstate`, `*.tfplan`, `tfplan` or `.env` files are staged (they are gitignored).
**STOP:** if any state, plan or secret file appears, run `git restore --staged <file>` and fix `.gitignore` first.

Both values in `ansible/group_vars/all/vault.yml` are inline-encrypted (`!vault |`). A gitleaks scan of the directory found no leaks (checked 2026-09-27).

```powershell
git commit -m "feat: commit P02-P05 ansible roles and jellyfin LXC"
git push
```
**EXPECTED:** the push succeeds and GitHub shows `ansible/` in the repo.

---

## Step 1: Record the IP before writing Terraform

**RUN IN:** your playbook source (the authoritative IP table)
**ACTION:** add this row **before** Step 2:

| Hostname | IP | Service | Created in |
|---|---|---|---|
| srv-pitwall-01 | 192.168.18.25 | Pit Wall On-Call (Docker Compose: postgres, api, caddy, cloudflared) | Interlude after P05 |

**VERIFY (Windows PowerShell):** `Test-Connection 192.168.18.25 -Count 1 -Quiet`
**EXPECTED:** `False`, meaning nothing answers on .25.
**STOP:** if it returns `True`, something already uses the IP. Find it before continuing. .25 is outside the DHCP pool (.70–254).

---

## Step 2: Terraform VM in the existing root

**RUN IN:** [Windows PowerShell]
**WORKING DIRECTORY:** `C:\Users\Rafif\Downloads\homelab-infra\terraform`
**FILE:** `pitwall.tf`
**ACTION:** CREATE this FULL FINAL FILE (it mirrors `proxmox_vm_qemu.proxy`):

```hcl
# pitwall.tf - Pit Wall On-Call production Docker host (interlude after P05)
resource "proxmox_vm_qemu" "pitwall" {
  name        = "srv-pitwall-01"
  target_node = "pve"

  clone      = "ubuntu-template"
  full_clone = true

  memory = 1536
  agent  = 1
  onboot = true
  scsihw = "virtio-scsi-pci"

  lifecycle {
    ignore_changes = [tags]
  }

  cpu {
    cores = 2
    type  = "host"
  }

  disk {
    slot    = "ide2"
    type    = "cloudinit"
    storage = "local-lvm"
  }

  disk {
    slot    = "scsi0"
    size    = "16G"
    storage = "local-lvm"
    type    = "disk"
    format  = "raw"
  }

  network {
    id     = 0
    model  = "virtio"
    bridge = "vmbr0"
  }

  os_type   = "cloud-init"
  ipconfig0 = "ip=192.168.18.25/24,gw=192.168.18.1"
  ciuser    = "devops"

  sshkeys = file(pathexpand("~/.ssh/id_ed25519_homelab.pub"))
}
```

**PREFLIGHT (secret injection, P01 pattern):** the Proxmox token secret is never stored in a file. Set it once per PowerShell session without it landing in PSReadLine history:
```powershell
$s = Read-Host "Proxmox token secret" -AsSecureString
$env:TF_VAR_pm_token = [System.Net.NetworkCredential]::new('', $s).Password
Remove-Variable s
$env:TF_VAR_pm_token.Length
```
**EXPECTED:** `36`. If Terraform prompts for `var.pm_token`, the variable is not set in this session. If the secret is lost, rotate it on the Proxmox host with `pveum user token remove terraform@pve tftoken` followed by `pveum user token add terraform@pve tftoken -privsep 0`. This is safe: with privsep 0 the permissions live on the user, and only Terraform uses the token.

PowerShell splits an unquoted `-out=file.tfplan` at the dot ("Too many command line arguments"), so **quote every `-flag=value` argument**:
```powershell
terraform fmt -recursive
terraform validate
terraform plan '-out=pitwall.tfplan'
terraform show pitwall.tfplan
```
**BLAST RADIUS:** additive only, a new VM. Existing VMs are untouched *if* the plan says so.
**EXPECTED:** `Plan: 1 to add, 0 to change, 0 to destroy`, and the only resource is `proxmox_vm_qemu.pitwall`.
**STOP:** if the plan shows any `~` update or `-/+` replacement of an existing resource. If unrelated cosmetic drift appears, keep the full plan as evidence and use `-target=proxmox_vm_qemu.pitwall` for containment only.

```powershell
terraform apply pitwall.tfplan
terraform plan
ssh -i "$HOME/.ssh/id_ed25519_homelab" devops@192.168.18.25 "hostname; nproc; free -m | head -2; df -h / | tail -1"
```
**EXPECTED:** the plan says `No changes`, the hostname is `srv-pitwall-01`, `nproc` is 2, total memory is about 1.4 GiB, and `/` is about 16G.
**ERROR:** if the IP is unreachable, check the VM console in Proxmox: cloud-init status and `ip a` (the interface is usually `ens18`).

---

## Step 3: Inventory and host key

**RUN IN:** [WSL Ubuntu]
**WORKING DIRECTORY:** `/mnt/c/Users/Rafif/Downloads/homelab-infra/ansible`

```bash
source ~/.venvs/homelab-ansible/bin/activate
export ANSIBLE_CONFIG="$PWD/ansible.cfg"
command -v ansible-playbook ansible-vault
```
**FILE:** `inventory.ini`
**ACTION:** APPEND this block above `[all:vars]`:
```ini
[pitwall]
srv-pitwall-01 ansible_host=192.168.18.25
```
Accept the host key **after** matching its fingerprint through the Proxmox console. In the console, run `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`.
```bash
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 exit
ssh-keygen -F 192.168.18.25 -l | grep -i ed25519
ansible-inventory --graph
ansible pitwall -m ansible.builtin.ping --ask-vault-pass
```
**EXPECTED:** the `ssh-keygen -F` fingerprint equals the console fingerprint, `srv-pitwall-01` appears under `@pitwall`, and the ping returns `pong`. `--ask-vault-pass` is needed even for a ping, because `group_vars/all/pihole_vault.yml` is a whole-file vault that is loaded for every host.
**STOP:** on `Host key verification failed` or `unreachable`. Never disable host-key checking.

---

## Step 4: CI deploy key (least privilege)

**RUN IN:** [WSL Ubuntu]
```bash
ssh-keygen -t ed25519 -N "" -C "pitwall-deploy@github-actions" -f ~/.ssh/id_ed25519_pitwall_deploy
ssh-keygen -lf ~/.ssh/id_ed25519_pitwall_deploy.pub
mkdir -p roles/pitwall_host/files
cp ~/.ssh/id_ed25519_pitwall_deploy.pub roles/pitwall_host/files/pitwall_deploy.pub
```
**WHY:** this key is separate from the admin key `id_ed25519_homelab`, so revoking CI access never touches your admin access. The **public** key is safe to commit. The **private** key goes only to a GitHub secret (Step 8).

---

## Step 5: Tailscale: dedicated CI tag and one grant

**RUN IN:** [Tailscale admin console → Access controls]
**ACTION:** merge these entries into the existing policy. Do not replace the policy.
```json
{
  "tagOwners": {
    "tag:ci-pitwall": ["autogroup:admin"]
  },
  "grants": [
    { "src": ["tag:ci-pitwall"], "dst": ["192.168.18.25"], "ip": ["tcp:22"] }
  ]
}
```
**WHY:** a separate tag means the portfolio CI (`tag:ci`) cannot reach this VM, and this repo's CI cannot reach `srv-proxy-01`.
**AUDIT:** grants are additive. If the policy still has a broad rule (for example `* → *`), the narrow grant does not restrict anything. Check the full policy.

**RUN IN:** [Tailscale admin console → Settings → OAuth clients]
**ACTION:** generate a **new** OAuth client with write scope for **Auth Keys**, limited to tag `tag:ci-pitwall`. Keep the client ID and secret for Step 8. Do not paste them anywhere else.

---

## Step 6: Cloudflare Tunnel `pitwall-prod`

**RUN IN:** [Cloudflare Zero Trust → Networks → Tunnels]
**ACTION:**
1. Create a tunnel of type Cloudflared, named `pitwall-prod`.
2. Copy only the **token** from the install command (the long string after `--token`). It goes into the vault in Step 7.
3. Add a published application: hostname `pitwall.rafifdzaky.com`, service `HTTP`, URL **`web:80`**. That is the compose service name, which cloudflared resolves on the compose network.

**VERIFY (DNS is a separate layer from the tunnel route; this was a portfolio incident):**
```powershell
Resolve-DnsName pitwall.rafifdzaky.com -Server 1.1.1.1
```
**EXPECTED:** a record exists (Cloudflare proxied). The tunnel shows **Inactive** until the first deploy starts cloudflared. That is harmless.
**STOP:** on NXDOMAIN. Fix the CNAME or route before Step 9.

---

## Step 7: Role `pitwall_host` (FINAL IaC STATE)

**RUN IN:** [WSL Ubuntu], same Ansible root.

**FILE:** `roles/pitwall_host/defaults/main.yml`, FULL FINAL FILE:
```yaml
---
pitwall_user: pitwall-deploy
pitwall_root: /opt/pitwall
pitwall_ghcr_owner: rafifdzaky27
```

**FILE:** `roles/pitwall_host/tasks/main.yml`, FULL FINAL FILE:
```yaml
---
- name: Fail early when a pitwall secret is missing or too short
  ansible.builtin.assert:
    that:
      - pitwall_postgres_password | length >= 32
      - pitwall_tunnel_token | length > 50
    quiet: true
  no_log: true

- name: Create the CI deploy user (no password, no sudo)
  ansible.builtin.user:
    name: "{{ pitwall_user }}"
    shell: /bin/bash
    groups: docker
    append: true
    password_lock: true

- name: Create .ssh for the deploy user
  ansible.builtin.file:
    path: "/home/{{ pitwall_user }}/.ssh"
    state: directory
    owner: "{{ pitwall_user }}"
    group: "{{ pitwall_user }}"
    mode: "0700"

- name: Authorize only the CI key, with pty and forwarding disabled
  ansible.builtin.copy:
    dest: "/home/{{ pitwall_user }}/.ssh/authorized_keys"
    content: "restrict {{ lookup('ansible.builtin.file', 'pitwall_deploy.pub') }}\n"
    owner: "{{ pitwall_user }}"
    group: "{{ pitwall_user }}"
    mode: "0600"

- name: Create the stack directory
  ansible.builtin.file:
    path: "{{ pitwall_root }}"
    state: directory
    owner: "{{ pitwall_user }}"
    group: "{{ pitwall_user }}"
    mode: "0750"

- name: Render managed secrets into .env (deploy.sh owns the TAG= line)
  ansible.builtin.blockinfile:
    path: "{{ pitwall_root }}/.env"
    create: true
    owner: "{{ pitwall_user }}"
    group: "{{ pitwall_user }}"
    mode: "0600"
    marker: "# {mark} ANSIBLE MANAGED: pitwall_host"
    block: |
      GHCR_OWNER={{ pitwall_ghcr_owner }}
      POSTGRES_PASSWORD={{ pitwall_postgres_password }}
      TUNNEL_TOKEN={{ pitwall_tunnel_token }}
      COMPOSE_PROFILES=tunnel
  no_log: true
```
**WHY `blockinfile`, not `template`:** `deploy.sh` rewrites the `TAG=` line on every deploy. A template would reset it on the next Ansible run, and Ansible and CI would keep undoing each other. With `blockinfile`, each owns its own lines.

**FILE:** `group_vars/pitwall/vault.yml`, created with inline-encrypted values (same format as `group_vars/all/vault.yml`):
```bash
mkdir -p group_vars/pitwall
openssl rand -hex 24 | tr -d '\n' | ansible-vault encrypt_string --ask-vault-pass --stdin-name pitwall_postgres_password > group_vars/pitwall/vault.yml
read -rsp "Paste tunnel token (hidden): " PITWALL_TT; echo
printf '%s' "$PITWALL_TT" | ansible-vault encrypt_string --ask-vault-pass --stdin-name pitwall_tunnel_token >> group_vars/pitwall/vault.yml
unset PITWALL_TT
grep -E '^[a-z_]+:' group_vars/pitwall/vault.yml
```
`tr -d '\n'` strips openssl's trailing newline so the password is exactly 48 characters (a newline would break a future `PGPASSWORD=`). `read -s` hides the token while you paste it, and `unset` clears it from the shell. The vault password prompt reads from the terminal, not from the pipe. **EXPECTED:** exactly two lines: `pitwall_postgres_password: !vault |` and `pitwall_tunnel_token: !vault |`. Neither value is readable. Use the **same vault password** as `group_vars/all/vault.yml`.

⚠️ Postgres reads `POSTGRES_PASSWORD` **only when the volume is first initialized**. Changing the vault value later does not rotate the DB password. Rotation is an explicit `ALTER USER` plus a vault change together.

**FILE:** `playbooks/pitwall.yml`, FULL FINAL FILE:
```yaml
---
- name: Configure srv-pitwall-01 as the Pit Wall On-Call Docker host
  hosts: pitwall
  become: true
  roles:
    - common
    - docker
    - pitwall_host
```

```bash
ansible-playbook playbooks/pitwall.yml --ask-vault-pass --syntax-check
ansible-playbook playbooks/pitwall.yml --ask-vault-pass
ansible-playbook playbooks/pitwall.yml --ask-vault-pass
```
**EXPECTED:** the first run shows `failed=0`. The **second run shows `changed=0`**, which is the idempotency proof.

**Service-specific health (`failed=0` is not proof):**
```bash
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 'bash -s' <<'EOF'
sudo -u pitwall-deploy docker compose version
sudo stat -c '%U:%G %a %n' /opt/pitwall /opt/pitwall/.env
sudo grep -c 'ANSIBLE MANAGED' /opt/pitwall/.env
sudo awk -F= '/^TUNNEL_TOKEN=/{print "tunnel token length", length($2)} /^POSTGRES_PASSWORD=/{print "pg password length", length($2)}' /opt/pitwall/.env
EOF
```
**EXPECTED:** Compose v2 is present; the owner is `pitwall-deploy` with mode `750` on the directory and `600` on `.env`; the marker count is `2`; the token length is over 50 and the password length is 48.

**Deploy-key check:**
```bash
ssh -i ~/.ssh/id_ed25519_pitwall_deploy pitwall-deploy@192.168.18.25 'id; docker ps'
ssh -i ~/.ssh/id_ed25519_pitwall_deploy -t pitwall-deploy@192.168.18.25 true
```
**EXPECTED:** the first command prints the `docker` group and an empty `docker ps`. The second prints `PTY allocation request failed`, which proves `restrict` is working.

**Commit the IaC (Windows PowerShell, homelab-infra root):**
```powershell
git add terraform/pitwall.tf ansible/inventory.ini ansible/roles/pitwall_host ansible/playbooks/pitwall.yml ansible/group_vars/pitwall
git commit -m "feat: add srv-pitwall-01 host for Pit Wall On-Call"
git push
```

---

## Step 8: GitHub secrets (environment `production` only)

Deploy secrets live in the **`production` environment**, never at repo level. The environment only accepts deployments from `main`, so a workflow on any other branch cannot read them. GitHub secrets are **write-only**: nobody can read a value back, and a lost value is rotated, never recovered.

**RUN IN:** [WSL Ubuntu] with `gh` logged in. **Run the interactive commands one at a time.** If a block is pasted, the lines after a prompt are read as the secret's value.
```bash
R=rafifdzaky27/pit-wall-on-call
gh secret set DEPLOY_SSH_KEY -R $R --env production < ~/.ssh/id_ed25519_pitwall_deploy
gh secret set DEPLOY_HOST    -R $R --env production --body 192.168.18.25
gh secret set DEPLOY_USER    -R $R --env production --body pitwall-deploy
ssh-keyscan -t ed25519 192.168.18.25 2>/dev/null > /tmp/pitwall_kh && ssh-keygen -lf /tmp/pitwall_kh
```
**VERIFY:** the fingerprint equals the console fingerprint from Step 3. **STOP** if it differs.
```bash
gh secret set DEPLOY_KNOWN_HOSTS -R $R --env production < /tmp/pitwall_kh && rm -f /tmp/pitwall_kh
```
Interactive, **one command each**. Paste the value from the Tailscale page that shows the new OAuth client:
```bash
gh secret set TS_OAUTH_CLIENT_ID -R $R --env production
```
```bash
gh secret set TS_OAUTH_SECRET -R $R --env production
```
```bash
gh secret list -R $R --env production
gh secret list -R $R
shred -u ~/.ssh/id_ed25519_pitwall_deploy
```
**EXPECTED:** six names in the environment and **none** at repo level. The private key is gone from the workstation.

The repository hardening (ruleset `protect-main`, the Actions allow-list with SHA pinning required, secret scanning with push protection, CodeQL, and Dependabot) is applied from the pit-wall-on-call session and recorded in its PRs.

---

## Rotation procedures

### Rotate the CI deploy key
Use this on suspected exposure, or after the private key is lost (the key only exists in GitHub). **Blast radius:** CI's SSH access only. The running game is unaffected, and deploys fail until the last step.

**RUN IN:** [WSL Ubuntu], Ansible root with `ANSIBLE_CONFIG` exported.
```bash
rm -f ~/.ssh/id_ed25519_pitwall_deploy.pub
ssh-keygen -t ed25519 -N "" -C "pitwall-deploy@github-actions $(date +%F)" -f ~/.ssh/id_ed25519_pitwall_deploy
cp ~/.ssh/id_ed25519_pitwall_deploy.pub roles/pitwall_host/files/pitwall_deploy.pub
ssh-keygen -lf roles/pitwall_host/files/pitwall_deploy.pub
ansible-playbook playbooks/pitwall.yml --ask-vault-pass
```
**EXPECTED:** the "Authorize only the CI key" task is `changed`. It overwrites `authorized_keys`, so **the old key is revoked** here. `Update apt cache` may also show `changed`, which is harmless.
```bash
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 'sudo wc -l /home/pitwall-deploy/.ssh/authorized_keys; sudo ssh-keygen -lf /home/pitwall-deploy/.ssh/authorized_keys'
ssh -i ~/.ssh/id_ed25519_pitwall_deploy pitwall-deploy@192.168.18.25 'id -nG'
ansible-playbook playbooks/pitwall.yml --ask-vault-pass
gh secret set DEPLOY_SSH_KEY -R rafifdzaky27/pit-wall-on-call --env production < ~/.ssh/id_ed25519_pitwall_deploy
shred -u ~/.ssh/id_ed25519_pitwall_deploy
```
**EXPECTED:** one key line with the new fingerprint, the new key logs in with group `docker`, and the second playbook run shows `changed=0`. Commit `roles/pitwall_host/files/pitwall_deploy.pub` in homelab-infra. Then run the deploy workflow from the Actions tab (Run workflow) as the end-to-end proof.

### Rotate the Tailscale OAuth client
Create a new OAuth client (Settings → Trust credentials: scope Auth Keys write, tag `tag:ci-pitwall`), set `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET` in the environment (one command each), **revoke the old client**, and run the deploy workflow. The value never needs a human copy: if it is lost, rotate again.

### Check the Postgres password after any `.env` change
Postgres reads `POSTGRES_PASSWORD` only when the volume is first created. If the Ansible "Render managed secrets" task reports `changed`, prove the database still accepts the password in `.env` **before the next deploy**. A mismatch breaks the api as soon as it is recreated, and its rollback too, because both use the same `.env`.

⚠️ Check over the **compose network**. Inside the postgres container, `127.0.0.1` and the local socket use `trust` auth (official image default), so a check there passes with any password.
```bash
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 'bash -s' <<'EOF'
sudo -u pitwall-deploy sh -c 'cd /opt/pitwall && set -a && . ./.env && set +a && docker compose run --rm --no-deps -e PGPASSWORD="$POSTGRES_PASSWORD" --entrypoint psql postgres -h postgres -U pitwall -d pitwall -tAc "select 1"'
EOF
```
**EXPECTED:** `1`. **STOP** on `password authentication failed`, then make the database follow the vault (the source of truth). The password goes through stdin, so it is not printed and not visible in the process list:
```bash
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 'bash -s' <<'EOF'
sudo -u pitwall-deploy sh -c 'cd /opt/pitwall && set -a && . ./.env && set +a && printf "ALTER USER pitwall PASSWORD \047%s\047;\n" "$POSTGRES_PASSWORD" | docker compose exec -T postgres psql -U pitwall -d pitwall -v ON_ERROR_STOP=1 -q && echo "ALTER ok"'
EOF
```
Then re-run the network check above, and `docker compose exec -T api wget -qO- http://127.0.0.1:8787/readyz` must return `{"status":"ready"}`.

---

## Step 9: First deploy

1. Mark PR #1 ready for review and merge it. `deploy.yml` runs CI, then images, then deploy.
2. **The first run is expected to fail at `docker compose pull`**, because new GHCR packages are private. Set `pitwall-api` and `pitwall-web` to **Public** (GitHub → Packages → Package settings → Change visibility), then re-run the failed `deploy` job.

**EXPECTED:** the deploy job is green. `https://pitwall.rafifdzaky.com` shows `API online · <sha>` and `Web build · <sha>` with the same SHA. The tunnel `pitwall-prod` shows **Healthy**.

**Negative checks:**
```bash
curl -s -o /dev/null -w "%{content_type}\n" https://pitwall.rafifdzaky.com/readyz
curl -sI https://pitwall.rafifdzaky.com/ | grep -iE "x-frame|x-content|server"
```
**EXPECTED:** the first returns `text/html` (the SPA fallback, meaning ops endpoints are not public). The second shows `X-Frame-Options: DENY` and `nosniff`, with `server: cloudflare` as the edge.

## Step 10: Game day (prove auto-rollback)

On branch `drill/broken-readiness`, make `/readyz` always return 503 (and adjust its test so CI passes). Merge it through a PR.
**EXPECTED:** `deploy.sh` prints `smoke test failed` → `rolling back to <previous sha>` → `rollback ok`. The job is red, and the public URL still serves the previous SHA. Revert through a PR, and the next deploy goes green.

---

### Game day record (2026-09-28)

A PR (#12, `5d73169`) made `/readyz` always return 503 and was merged to `main`. The hypotheses were written in the PR before the merge.

| # | Hypothesis | Result | Evidence |
|---|---|---|---|
| H1 | The smoke test rejects the broken release | ✅ | `smoke test failed for 5d73169…` |
| H2 | `deploy.sh` rolls back to the previous release | ✅ | `rolling back to fd8bcf9…` → `rollback ok: fd8bcf9…` |
| H3 | The deploy job goes red, and `public-smoke` does not run | ✅ | `Process completed with exit code 1` |
| H4 | Players see no impact | ✅ | The public site served `fd8bcf9` (API and web) throughout |

During rollback only `api` and `web` were recreated, and `postgres` stayed `Running`, so data was never touched. The drill was reverted through a normal PR, and that deploy went green.

## Rollback (executable)

| Scope | Command |
|---|---|
| Bad app release | Automatic: `deploy.sh` restores the previous tag. Manual (the CI key lives only in GitHub, so use the admin path): `ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 'sudo -u pitwall-deploy /opt/pitwall/deploy.sh <previous-sha>'` |
| Stop public exposure | Cloudflare → Tunnels → `pitwall-prod` → delete the published application (the VM keeps running privately) |
| Revoke CI access | Remove the `tag:ci-pitwall` grant and revoke the OAuth client; delete `DEPLOY_SSH_KEY` |
| Remove the host entirely | `terraform plan -destroy '-target=proxmox_vm_qemu.pitwall' '-out=rm.tfplan'` → review (**only** the pitwall VM) → `terraform apply rm.tfplan`; revert the inventory, role and group_vars commits |

## Final topology

```
Internet ─► Cloudflare edge (TLS, WAF) ─► Tunnel pitwall-prod (outbound only)
                                                 │
srv-pitwall-01 192.168.18.25 (VM, 2c/1.5G/16G) ◄─┘
  compose network "pitwall_default":
    cloudflared ─► web (Caddy :80) ─► /api/* ─► api (:8787) ─► postgres (:5432, volume pgdata)
  host: UFW deny-by-default, SSH 22 only
GitHub Actions runner ─► tailnet (tag:ci-pitwall) ─► srv-vpn-01 subnet route ─► :22 as pitwall-deploy
```
Audience: public players (web), Rafif (admin over LAN/tailnet), and CI (deploy only).

## Database migrations and the runs API (M2)

- **What deploy.sh does now:** pull → `docker compose run --rm -T api node dist/migrate.js` with the new tag → `up -d` → smoke test. The smoke test is `/readyz` (which is 503 `migrations_pending` until the schema matches the image), `/api/version` through Caddy, and a dry-run replay of a fixture run through Caddy (`node dist/smoke.js http://web:80`, which stores nothing).
- **A failed migration** stops the deploy before anything restarts: `.env` keeps the old tag and production keeps running. Read the error in the job log, fix the migration in a PR, and deploy again.
- **Migrations must be backward compatible.** A failed smoke test rolls back to the previous image on the new schema, so a release only adds tables, columns and indexes. Dropping or renaming happens in a later release, once nothing uses the old shape.
- **Check the schema by hand:**
  ```bash
  docker compose exec -T postgres psql -U pitwall -d pitwall -c 'select id, created_at from drizzle.__drizzle_migrations order by id'
  ```
- **Flagged runs** (implausibly fast fixes) are kept off the board until reviewed:
  ```bash
  docker compose exec -T postgres psql -U pitwall -d pitwall -c "select id, player_id, budget_burned_bp, created_at from runs where flagged order by created_at desc limit 20"
  ```
- **Metrics:** the API serves `/metrics` inside the compose network only (Caddy proxies `/api/*`). To look at it by hand, run `docker compose exec -T api wget -qO- http://127.0.0.1:8787/metrics | head`. Prometheus scraping and the Grafana dashboard are M5.

## M5: launch readiness (backups, analytics, uptime, WAF)

Design: `docs/specs/2026-10-01-m5-launch-readiness-design.md`. Do these **after** the M5 PR is merged and its deploy is green, because the deploy ships `/opt/pitwall/backup/*.sh` and the Umami service definition.

**State before:** no backups, no analytics, no external uptime check, no WAF rule. RAM measured 2026-10-01: 890 MB available of 1463 MB, so Umami (capped at 384 MB) fits and Terraform does not change.
**Created:** restic repo `/var/backups/pitwall-restic`, offsite repo `gdrive:pitwall-backups`, systemd timers `pitwall-backup` (nightly 03:15) and `pitwall-restore-test` (Sun 04:00), the `umami` database and container, an external monitor, one Cloudflare rate-limit rule.
**Not touched:** the `pitwall` database schema, the tunnel, Tailscale policy, other hosts.

### M5-0: Commit the homelab-infra Pit Wall work first

**RUN IN:** [Windows PowerShell] · **WORKING DIRECTORY:** `C:\Users\Rafif\Downloads\homelab-infra`
On 2026-10-01 `git status` still showed the Pit Wall host as uncommitted (`terraform/pitwall.tf`, `ansible/roles/pitwall_host/`, `ansible/playbooks/pitwall.yml`, `ansible/group_vars/pitwall/`, `inventory.ini`). Claude has since added the M5 changes on top: the new role `ansible/roles/pitwall_backup/`, the Umami switch in `pitwall_host` (defaults and tasks), and the backup role in `playbooks/pitwall.yml`.
```powershell
git status --short
git diff ansible/inventory.ini
git add terraform/pitwall.tf ansible/inventory.ini ansible/roles/pitwall_host ansible/roles/pitwall_backup ansible/playbooks/pitwall.yml ansible/group_vars/pitwall
git status --short
```
**VERIFY:** read `ansible/roles/pitwall_backup/tasks/main.yml` and `ansible/roles/pitwall_host/tasks/main.yml` before committing; nothing secret is in them (secrets come from the vault).
**EXPECTED:** after `git add`, nothing Pit Wall-related remains untracked.
```powershell
git commit -m "feat: srv-pitwall-01 host, backups and analytics switch (Pit Wall M5)"
git push
```

### M5-1: GDrive token for rclone (browser, on your PC)

**RUN IN:** [WSL Ubuntu] · **WORKING DIRECTORY:** `/mnt/c/Users/Rafif/Downloads/homelab-infra/ansible`
rclone is installed in WSL only to run the browser login once; the server never opens a browser.
```bash
sudo apt-get install -y rclone
rclone authorize "drive" "eyJzY29wZSI6ImRyaXZlLmZpbGUifQ"
```
The second argument is `{"scope":"drive.file"}` in base64: rclone will only ever see files it created itself, never the rest of your Drive.
**ACTION:** open the printed `http://127.0.0.1:53682/auth?...` link in Windows, sign in with the Google account that should hold the backups, allow access. WSL forwards localhost, so the redirect reaches rclone.
**EXPECTED:** the terminal prints `Paste the following into your remote machine --->`, then the token, then `<---End paste`. Newer rclone prints the token as a base64 blob starting `eyJ`; older versions print JSON starting `{"access_token":`. The role accepts both.
**STOP:** do not paste that JSON into chat or a file. It is a credential to your Drive. Copy it once for the next step.
**ERROR:** `bind: address already in use` means another rclone is waiting; close it and run again.

### M5-2: Secrets into the vault

**RUN IN:** [WSL Ubuntu] · **WORKING DIRECTORY:** `/mnt/c/Users/Rafif/Downloads/homelab-infra/ansible`
```bash
read -rsp "Paste rclone token JSON (hidden): " RC_TOKEN; echo
printf '%s' "$RC_TOKEN" | ansible-vault encrypt_string --ask-vault-pass --stdin-name pitwall_rclone_gdrive_token >> group_vars/pitwall/vault.yml
unset RC_TOKEN
openssl rand -hex 24 | tr -d '\n' | ansible-vault encrypt_string --ask-vault-pass --stdin-name pitwall_restic_password >> group_vars/pitwall/vault.yml
openssl rand -hex 24 | tr -d '\n' | ansible-vault encrypt_string --ask-vault-pass --stdin-name pitwall_umami_db_password >> group_vars/pitwall/vault.yml
openssl rand -hex 32 | tr -d '\n' | ansible-vault encrypt_string --ask-vault-pass --stdin-name pitwall_umami_app_secret >> group_vars/pitwall/vault.yml
printf -- '---\npitwall_analytics_enabled: true\n' > group_vars/pitwall/main.yml
grep -E '^[a-z_]+:' group_vars/pitwall/vault.yml
```
**EXPECTED:** six names, each followed by `!vault |`: the two from Step 7 plus `pitwall_rclone_gdrive_token`, `pitwall_restic_password`, `pitwall_umami_db_password`, `pitwall_umami_app_secret`. Same vault password as before.
⚠️ **The restic password is the only key to every backup.** If the vault is lost, the backups are unreadable. Put a second copy in your password manager now (Vaultwarden later), labelled "pitwall restic".

### M5-3: Apply the playbook

**RUN IN:** [WSL Ubuntu], same directory.
```bash
ansible-playbook playbooks/pitwall.yml --ask-vault-pass --syntax-check
ansible-playbook playbooks/pitwall.yml --ask-vault-pass
ansible-playbook playbooks/pitwall.yml --ask-vault-pass
```
**EXPECTED:** the first run has `failed=0`, and its two "Initialise ... restic repository" tasks report `changed`. **The second run shows `changed=0`**, which proves it is idempotent: the repositories already exist, and the rclone config is never overwritten (`force: false`, because rclone refreshes the token inside it).
**ERROR:**
- `Failed to set permissions on the temporary files` means `acl` is missing. The role installs it, so run the playbook again.
- An offsite init failure that mentions `couldn't find root directory ID` or `invalid_grant` means the token is wrong. Fix the vault value, remove `/home/pitwall-deploy/.config/rclone/rclone.conf` on the VM, and run again.
**ROLLBACK:** `sudo systemctl disable --now pitwall-backup.timer pitwall-restore-test.timer` stops all backup activity. Data in the repositories stays.

**Commit** (Windows PowerShell, homelab-infra root). The vault values are encrypted, so they are safe to commit:
```powershell
git add ansible/group_vars/pitwall
git commit -m "feat: pitwall backup and analytics secrets"
git push
```

### M5-4: First backup and first restore test (by hand)

**RUN IN:** [Windows PowerShell]
```powershell
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 "sudo systemctl start pitwall-backup.service; sudo systemctl status pitwall-backup.service --no-pager | head -5; sudo journalctl -u pitwall-backup.service -n 20 --no-pager"
```
**EXPECTED:** `status=0/SUCCESS`, and the journal shows a snapshot saved for `pitwall` and for `umami` if it exists yet. After that, `forget` and `copy` to the offsite repository.
```powershell
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 "sudo -u pitwall-deploy bash -c 'set -a; . /etc/pitwall-backup/env; restic snapshots --compact; restic -r `$RESTIC_OFFSITE_REPOSITORY snapshots --compact'"
```
**EXPECTED:** one snapshot tagged `pitwall` in each table with the **same time**. The IDs differ, because `restic copy` gives the copy a new ID in the target repository. In Drive, a `pitwall-backups` folder now exists.
Lines with `RATE_LIMIT_EXCEEDED` or `500 Internal Server Error` followed by `operation successful after N retries` are noise from rclone's shared Google app ID; see "Own Google OAuth client" below.
```powershell
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 "sudo systemctl start pitwall-restore-test.service; sudo journalctl -u pitwall-restore-test.service -n 30 --no-pager; sudo systemctl list-timers 'pitwall-*' --no-pager"
```
**EXPECTED:** every table is listed with matching counts, the unit ends with `status=0/SUCCESS`, and both timers show a NEXT time. No `pitwall-restore-*` container is left over: `sudo docker ps -a` shows none.
**STOP:** a failed restore test means the backups cannot be trusted. Do not continue to launch; paste the journal here.

### M5-5: Turn Umami on

The Ansible run in M5-3 already wrote `COMPOSE_PROFILES=tunnel,analytics` and the Umami secrets into `.env`. The next `deploy.sh` creates the `umami` role and database, then starts the container. Redeploy the running tag:

**RUN IN:** [Windows PowerShell]
```powershell
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 "sudo -u pitwall-deploy sh -c 'cd /opt/pitwall && ./deploy.sh `$(grep -E ^TAG= .env | cut -d= -f2)'"
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 "sudo docker compose --project-directory /opt/pitwall ps umami; sudo docker stats --no-stream --format '{{.Name}} {{.MemUsage}}'; free -m"
```
**EXPECTED:** `deploy ok`; `umami` is `running` (it has no healthcheck, so it never shows `healthy`); its memory is under 384 MiB; total `available` RAM (`free -m`) is still above 400 MB.
**ERROR:**
- `UMAMI_DB_PASSWORD ... unsafe` means the password has characters outside `[A-Za-z0-9._~-]`. The `openssl rand -hex` output never does, so check the vault value.
- If `umami` restarts in a loop, run `sudo docker compose logs --tail 50 umami`. A Prisma `P1000` error means an authentication mismatch. Redeploy once; `deploy.sh` syncs the password on every run.

**First login (admin UI is loopback-only, never public):**
```powershell
ssh -i ~/.ssh/id_ed25519_homelab -L 3001:127.0.0.1:3001 devops@192.168.18.25
```
1. Leave that session open and go to `http://localhost:3001`. Log in as `admin` / `umami`, then **immediately** change the password (Settings → Profile). Save it in your password manager.
2. Go to Settings → Websites → Add. Use name `Pit Wall On-Call` and domain `pitwall.rafifdzaky.com`. Copy the **Website ID** (a UUID).
3. Set it as a repository variable (not a secret, because it is visible in the page source anyway), then rebuild:
```powershell
gh variable set UMAMI_WEBSITE_ID --body "<website-id>" --repo rafifdzaky27/pit-wall-on-call
```
Then tell Claude: the ID is built into the web image, so it takes effect with the **next merge to `main`** (Claude ships a small follow-up PR for this). Do **not** re-run the deploy workflow for the SHA that is already live: it rebuilds and overwrites that same image tag, so if its smoke test failed there would be nothing to roll back to.
**VERIFY:**
- Once `public-smoke` is green, open the site in a normal window with Do Not Track off.
- `https://pitwall.rafifdzaky.com/stats/script.js` returns JavaScript.
- `https://pitwall.rafifdzaky.com/stats/` returns `Not found`: the UI is not public.
- Umami's Realtime view shows you within a minute.
- Play to the first ack; `ack` shows under Events.

**ROLLBACK:** set `pitwall_analytics_enabled: false`, re-run the playbook, then remove the container (switching a profile off does not stop a running service):
```powershell
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 "sudo docker compose --project-directory /opt/pitwall rm -sf umami"
```
The `umami` database stays, and backups keep including it.

### M5-6: External uptime monitor

**RUN IN:** [Browser] UptimeRobot (free) or Better Stack (free). This is your own account.
- **Monitor:** type HTTP(s) – Keyword. URL `https://pitwall.rafifdzaky.com/api/healthz`, keyword `"ok"` (must exist), interval 5 minutes.
- **Alerts:** the mobile app push and email. Send a test notification and confirm your phone gets it.
- **Why outside the homelab:** a monitor inside the homelab dies with the power or ISP it is supposed to report on.
**VERIFY:** the monitor shows Up. For a real test, stop the tunnel for six minutes, then start it again. The site is down for players during that window, so do it at a quiet time:
```powershell
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 "sudo docker compose --project-directory /opt/pitwall stop cloudflared"
ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 "sudo docker compose --project-directory /opt/pitwall start cloudflared"
```
Run the second command six minutes after the first. **EXPECTED:** a Down alert on your phone, then an Up alert.

**Backup alerts (required, not optional):** a failed backup writes only to the journal, so without this you learn about it on the day you need a restore.
- At healthchecks.io (free, your account) create two checks: `pitwall backup` (period 1 day, grace 2 hours) and `pitwall restore test` (period 7 days, grace 6 hours). Connect the same phone/email integration.
- Add both ping URLs to `group_vars/pitwall/main.yml` (WSL, ansible directory):
  ```bash
  printf 'pitwall_backup_ping_url: "%s"
pitwall_restore_test_ping_url: "%s"
' "https://hc-ping.com/<backup-uuid>" "https://hc-ping.com/<restore-uuid>" >> group_vars/pitwall/main.yml
  ansible-playbook playbooks/pitwall.yml --ask-vault-pass --tags backup
  ```
- The units ping only on success, so a failing **or** never-running job alerts by silence.
- **VERIFY:** run the two services by hand again (the M5-4 commands). Both checks turn green on healthchecks.io.

### M5-7: Cloudflare rate-limit rule

**RUN IN:** [Cloudflare dashboard → rafifdzaky.com → Security → WAF → Rate limiting rules]
The free plan allows one rule. It sits in front of the API's own limits (60 runs/min per IP, 120 leaderboard reads/min per IP), so it is looser than them. It only stops floods before they reach the homelab.
- **Rule name:** `pitwall api flood`
- **If incoming requests match** (Edit expression):
  `(http.host eq "pitwall.rafifdzaky.com" and (starts_with(http.request.uri.path, "/api/") or http.request.uri.path eq "/stats/api/send"))`
  The second half covers Umami's public collect endpoint, which has no rate limit of its own and writes into the same Postgres.
- **Same characteristics:** IP
- **When rate exceeds:** 50 requests per 10 seconds
- **Then take action:** Block, for 10 seconds
**VERIFY:**
- Normal play and the leaderboard still work.
- From PowerShell, this prints mostly `200`, then `429` once the rule triggers:
  ```powershell
  1..70 | % { curl.exe -s -o NUL -w "%{http_code} " https://pitwall.rafifdzaky.com/api/healthz }
  ```
  Cloudflare's block page returns 429.
- Security → Events lists the block.
**ROLLBACK:** toggle the rule off.

### Own Google OAuth client for rclone (recommended follow-up)

rclone's built-in Google app ID is shared by thousands of users, so Drive answers with `RATE_LIMIT_EXCEEDED` and rclone has to retry (seen on the first backup, 2026-10-01). It works, but a bad day can fail a nightly run.

**Do this once, in the browser, at Google Cloud Console** (free):
1. Create a project, `pitwall-backup`.
2. Enable the Google Drive API.
3. Set up the OAuth consent screen: External, add yourself as a test user, then **publish** it. Unpublished test apps get refresh tokens that expire after 7 days.
4. Create an OAuth client ID of type **Desktop app**.

Then redo M5-1 with the new client:
```bash
rclone authorize "drive" "<client_id>" "<client_secret>"
```
Replace the token in the vault, then run `ansible-playbook ... --tags backup`. The rclone config must then carry `client_id` and `client_secret` too. **Tell Claude before you do this**, because the role needs two more vault values.

### M5-8: Prometheus and Grafana (later, at the playbook's Observability project)

The files are ready in `infra/observability/`: `prometheus-scrape.yml` and `grafana-dashboard.json`. `/metrics` is still private to the compose network. When `srv-mon-01` exists:
1. Publish the API's 8787 on the VM's **tailnet IP only**, never `0.0.0.0`.
2. Allow `srv-mon-01 → srv-pitwall-01:8787` in the Tailscale grants.
3. Add the scrape job with the real IP.
4. Import the dashboard.

This is not needed for launch.

### Move to a VPS (homelab outage longer than a few hours)

**Target:** RTO 1 hour, RPO 24 hours (the last nightly backup).
1. **Provision:** a VPS with Ubuntu 24.04 LTS, 2 GB of RAM and Docker Engine with the Compose plugin. Create user `pitwall-deploy` in the `docker` group.
2. **Restore access to backups:** install `restic` and `rclone`. Copy the GDrive token and restic password from your password manager into `~/.config/rclone/rclone.conf` (remote `gdrive`, `scope = drive.file`) and a `0400` password file.
3. **Stack files:** from a checkout of `main`, copy `infra/docker-compose.yml`, `infra/deploy.sh` and `infra/backup/` to `/opt/pitwall/`. Write `.env` with the same values the vault holds: `GHCR_OWNER`, `POSTGRES_PASSWORD`, `TUNNEL_TOKEN`, `COMPOSE_PROFILES`, and the Umami keys if analytics is on. Add `TAG=<last deployed sha>`.
4. **Database first:** run `docker compose up -d postgres` and wait for it to be healthy.
5. **Restore the dump:**
   - `restic -r rclone:gdrive:pitwall-backups snapshots --tag pitwall` and pick the newest.
   - `restic -r rclone:gdrive:pitwall-backups dump <id> pitwall.dump | docker compose exec -T postgres pg_restore -U pitwall -d pitwall --clean --if-exists --no-owner` (restic prompts for the repository password; or add `--password-file <file>`)
   - For `umami` (tag `umami`), if you use analytics: create the role and database first, the same way `deploy.sh` does, then restore **as `umami`** so it owns its tables: `... dump <id> umami.dump | docker compose exec -T postgres pg_restore -U pitwall -d umami --clean --if-exists --no-owner --role=umami`.
6. **Start everything:** `./deploy.sh <TAG>`.
   - The tunnel token is the same, so `pitwall-prod` connects from the new host. **Stop cloudflared on the homelab first** if it is still running, so the two connectors don't split traffic.
7. **Verify:**
   - `public-smoke` (re-run the deploy workflow's last run, or `curl https://pitwall.rafifdzaky.com/api/version`).
   - The leaderboard shows yesterday's scores.
8. **CI:** point the GitHub `production` secrets `DEPLOY_HOST` and `DEPLOY_KNOWN_HOSTS` at the VPS. Without that, deploys keep targeting the homelab.
9. **Coming back:** reverse steps 1–8, with a fresh backup from the VPS as the source.

## Known follow-ups
- The `common` role in homelab-infra still allows SSH from *Anywhere* (the playbook's revised version scopes it to `trusted_admin_networks`). Apply the revised role across all hosts in a separate, planned change.
- Hardening: an SSH forced command for `pitwall-deploy`, so the key can only run `deploy.sh`.
- homelab-infra `common` role uses `ansible_virtualization_type` (INJECT_FACTS_AS_VARS deprecation). Switch to `ansible_facts["virtualization_type"]` before ansible-core 2.24 removes it.
- `group_vars/all/pihole_vault.yml` is loaded for every host, including this one. Move it to `group_vars/dns2/` so only the Pi-hole host receives Pi-hole secrets.
- Backups: done in M5 (see "M5: launch readiness"). When `srv-backup-01` exists, move `pitwall_backup_repo` there; the scripts do not change.

## Revision log

| EXPECTED | ACTUAL | ROOT CAUSE | FIX | PERMANENT REVISION |
|---|---|---|---|---|
| `terraform plan -out=pitwall.tfplan` writes a plan | "Too many command line arguments" | PowerShell splits an unquoted `-flag=value` containing a dot | `terraform plan '-out=pitwall.tfplan'` | All `-flag=value` arguments in this runbook are quoted |
| `ansible pitwall -m ping` returns pong | `Attempting to decrypt but no vault secrets found` | `group_vars/all/pihole_vault.yml` is whole-file encrypted, so it is decrypted when vars load for any host | `--ask-vault-pass` | Step 3 uses `--ask-vault-pass`; follow-up: move Pi-hole secrets to `group_vars/dns2/` (least privilege) |
| First deploy job green end to end | `deploy.sh` reported `deploy ok` and the site was live, but the public smoke step failed with `Could not resolve host` | The runner was still on the tailnet. Tailnet DNS overrides to AdGuard/Pi-hole (192.168.18.11/.12), and the new policy deliberately gives `tag:ci-pitwall` only `.25:22`, so DNS was denied. Before, `* → *` hid this dependency | The public check moved to its own `public-smoke` job that never joins the tailnet | The public check runs from the internet's perspective. Note: `tag:ci` (portfolio) lost tailnet DNS in the same policy change |
| Paste the Step 8 block and each prompt receives its own value | The `TS_OAUTH_CLIENT_ID` prompt was waiting while the remaining pasted lines queued behind it; the OAuth secret had not been saved | Interactive `gh secret set` reads the terminal, so pasted lines become answers. GitHub secrets are write-only, so nothing could be recovered | Ctrl+C; rotated the OAuth client; set the values one command at a time | Step 8 separates interactive commands; rotation procedures added |
| Rotation playbook run shows only the key task `changed` | `changed=3`: apt cache, the key, and the `.env` managed block | The apt cache refreshed (harmless); the cause of the `.env` block change was not captured (`no_log` hides the diff) | Proved the password in `.env` still opens the database (`select 1`) before the next deploy | "Check the Postgres password after any `.env` change" procedure |
| Deploy secrets are protected by the environment's `main`-only rule | All six secrets were at repo level, readable by any branch workflow | Secrets were created before the environment existed | Moved to `production` (rotating the ones without a human copy) and deleted the repo-level copies | Step 8 uses `--env production` only |
| Redeploy of the same SHA is green | `smoke test failed … no previous tag to roll back to`; `/api/version` 200 but `/readyz` 503 and 90 `password authentication failed` in postgres logs | The `.env` password no longer matched the DB (set at volume init). The earlier check used `psql -h 127.0.0.1` inside the postgres container, which is `trust` auth and passes with any password. The old api container hid it until pulled images forced a recreate | `ALTER USER` from `.env` over the local socket, verified over the compose network | The password check runs over the compose network; follow-up: log the readiness failure reason in the api |
| Plan authenticates to Proxmox | Prompt for `var.pm_token`, then `401 Authentication failed` | `TF_VAR_pm_token` not set in the session, and the secret was not at hand | Set it with `Read-Host -AsSecureString`; rotate the token if lost | A Step 2 preflight sets and checks the token (length 36) before planning |
