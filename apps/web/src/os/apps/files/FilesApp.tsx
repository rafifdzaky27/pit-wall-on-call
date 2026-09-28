import { HOME_FILES } from "../../../content/files";
import { FileBrowser } from "./FileBrowser";

export function FilesApp() {
  return <FileBrowser files={HOME_FILES} label="Home" />;
}
