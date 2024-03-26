import "npm:esbuild";
import "npm:rollup";
import "npm:wbn";
import "npm:zod";
import "npm:mime";
import "npm:base32-encode";

const decoder = new TextDecoder();
// Download GitHub repository to node_modules/.deno, link in node_modules
async function installRepositoryFromGitHubToNodeModules(url) {
  return new Deno.Command("/bin/sh", {
  /*
    cd node_modules/.deno
    git clone "$1"
    cd ..
    ln -s  "`pwd`/.deno/$2" "`pwd`"
  */
    args: [
      "install_from_github.sh",
      url,
      url.split("/").pop(),
    ],
  }).output();
}

const { code, stdout, stderr } = await installRepositoryFromGitHubToNodeModules(
  "https://github.com/guest271314/wbn-sign-webcrypto",
);

console.log([stdout, stderr].map((result) => decoder.decode(result)));
