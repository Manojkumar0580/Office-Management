import mongoose from "mongoose";
import chalk from "chalk";

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn(chalk.yellow("MONGODB_URI not set; skipping MongoDB connection"));
    return;
  }

  await mongoose.connect(uri);
  console.log(chalk.green("Connected to MongoDB"));
}
