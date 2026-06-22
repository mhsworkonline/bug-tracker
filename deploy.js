const { execSync } = require("child_process");

const msg = process.argv.slice(2).join(" ") || "update";

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { stdio: "inherit" });
}

run("git add -A");
run(`git commit -m "${msg}"`);
run("git push origin main");
