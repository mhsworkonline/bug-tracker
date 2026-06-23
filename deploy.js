const { execSync } = require("child_process");

const args = process.argv.slice(2);
const command = args[0];

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

require("dotenv").config({ path: ".env.local" });
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_SCOPE = process.env.VERCEL_SCOPE || "mhsw-ork";

if (!VERCEL_TOKEN) {
  console.error("Missing VERCEL_TOKEN in .env.local");
  process.exit(1);
}

if (command === "pull") {
  run("git pull origin main");
  run("npm install");
} else {
  const msg = args.join(" ") || "update";
  run("git add -A");
  run(`git commit -m "${msg}"`);
  run("git push origin main");
  console.log("\nDeploying to Vercel...");
  run(`npx vercel deploy --token ${VERCEL_TOKEN} --scope ${VERCEL_SCOPE} --prod --yes`);
}
