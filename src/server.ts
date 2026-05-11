import dotenv from "dotenv";
import chalk from "chalk";
import { connectDb } from "./config/db";
import { createApp } from "./app";

dotenv.config();

async function main() {
  await connectDb();

  const app = createApp();
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(chalk.cyan(`Server listening on http://localhost:${port}`));
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
