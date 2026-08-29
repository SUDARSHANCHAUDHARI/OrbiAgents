import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const icon = path.resolve("build", "icon.icns");
const info = await stat(icon).catch(() => null);
if (!info?.isFile() || info.size < 8) throw new Error("Release requires a branded build/icon.icns generated from a 1024x1024 source icon");
const header = await readFile(icon).then((value) => value.subarray(0, 4).toString("ascii"));
if (header !== "icns") throw new Error("build/icon.icns is not a valid ICNS container");
const iconMetadata = await promisify(execFile)("sips", ["-g", "pixelWidth", "-g", "pixelHeight", icon]);
const dimensions = [...iconMetadata.stdout.matchAll(/pixel(?:Width|Height):\s+(\d+)/g)].map((match) => Number(match[1]));
if (dimensions.length !== 2 || dimensions.some((value) => value < 1024)) throw new Error("build/icon.icns must contain a 1024x1024 representation");

const environment = process.env;
const hasApiKey = present("APPLE_API_KEY") && present("APPLE_API_KEY_ID") && present("APPLE_API_ISSUER");
const hasAppleId = present("APPLE_ID") && present("APPLE_APP_SPECIFIC_PASSWORD") && present("APPLE_TEAM_ID");
const hasKeychainProfile = present("APPLE_KEYCHAIN_PROFILE");
if (!hasApiKey && !hasAppleId && !hasKeychainProfile) throw new Error("Notarization credentials are not configured in the environment or keychain profile");

const hasCertificateFile = present("CSC_LINK") && present("CSC_KEY_PASSWORD");
if (!hasCertificateFile && !await hasDeveloperIdIdentity()) throw new Error("Developer ID Application signing identity is unavailable");
console.log("macOS release prerequisites are present; secret values were not inspected or printed");

function present(name) { return typeof environment[name] === "string" && environment[name].length > 0; }
async function hasDeveloperIdIdentity() {
  try { const { stdout } = await promisify(execFile)("security", ["find-identity", "-v", "-p", "codesigning"]); return /Developer ID Application:/.test(stdout); }
  catch { return false; }
}
