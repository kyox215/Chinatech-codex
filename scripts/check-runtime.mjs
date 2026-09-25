// Keep local commands aligned with package.json/CI without changing the user's shell.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error(
    `RepairDesk requires Node >=22.12.0; current: ${process.versions.node}. Run nvm use (see .nvmrc) or select a compatible Node runtime.`,
  );
  process.exitCode = 1;
}
