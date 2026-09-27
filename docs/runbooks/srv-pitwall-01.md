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

```powershell
terraform fmt -recursive
terraform validate
terraform plan -out=pitwall.tfplan
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
ansible-inventory --graph
ansible pitwall -m ansible.builtin.ping
```
**EXPECTED:** `srv-pitwall-01` appears under `@pitwall`, and the ping returns `pong`.
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

## Step 8: GitHub secrets and settings (rafifdzaky27/pit-wall-on-call)

**RUN IN:** [WSL Ubuntu] with `gh` logged in. Values are read from files or stdin, so nothing is echoed.
```bash
R=rafifdzaky27/pit-wall-on-call
gh secret set DEPLOY_SSH_KEY     -R $R < ~/.ssh/id_ed25519_pitwall_deploy
ssh-keyscan -t ed25519 192.168.18.25 2>/dev/null > /tmp/pitwall_known_hosts
ssh-keygen -lf /tmp/pitwall_known_hosts
gh secret set DEPLOY_KNOWN_HOSTS -R $R < /tmp/pitwall_known_hosts
gh secret set DEPLOY_HOST        -R $R --body 192.168.18.25
gh secret set DEPLOY_USER        -R $R --body pitwall-deploy
gh secret set TS_OAUTH_CLIENT_ID -R $R
gh secret set TS_OAUTH_SECRET    -R $R
gh secret list -R $R
```
**VERIFY:** the fingerprint printed by `ssh-keygen -lf /tmp/pitwall_known_hosts` must equal the console fingerprint from Step 3. **STOP** if it differs. The last two `gh secret set` commands prompt for the value with input hidden.
**EXPECTED:** `gh secret list` shows all six names.

Then remove the local private key. It now lives only in GitHub, and rotation means generating a new key:
```bash
shred -u ~/.ssh/id_ed25519_pitwall_deploy && rm -f /tmp/pitwall_known_hosts
```
The GitHub environment `production` and branch protection on `main` (requiring check `check`) are applied from the pit-wall-on-call session.

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

## Rollback (executable)

| Scope | Command |
|---|---|
| Bad app release | Automatic: `deploy.sh` restores the previous tag. Manual (the CI key lives only in GitHub, so use the admin path): `ssh -i ~/.ssh/id_ed25519_homelab devops@192.168.18.25 'sudo -u pitwall-deploy /opt/pitwall/deploy.sh <previous-sha>'` |
| Stop public exposure | Cloudflare → Tunnels → `pitwall-prod` → delete the published application (the VM keeps running privately) |
| Revoke CI access | Remove the `tag:ci-pitwall` grant and revoke the OAuth client; delete `DEPLOY_SSH_KEY` |
| Remove the host entirely | `terraform plan -destroy -target=proxmox_vm_qemu.pitwall -out=rm.tfplan` → review (**only** the pitwall VM) → `terraform apply rm.tfplan`; revert the inventory, role and group_vars commits |

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

## Known follow-ups
- The `common` role in homelab-infra still allows SSH from *Anywhere* (the playbook's revised version scopes it to `trusted_admin_networks`). Apply the revised role across all hosts in a separate, planned change.
- Hardening: an SSH forced command for `pitwall-deploy`, so the key can only run `deploy.sh`.
- Backups (M5): `pg_dump` → restic → offsite, plus a restore test.

## Revision log

| EXPECTED | ACTUAL | ROOT CAUSE | FIX | PERMANENT REVISION |
|---|---|---|---|---|
| | | | | |
