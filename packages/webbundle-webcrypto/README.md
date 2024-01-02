# webbundle-webcrypto
Generate Signed Web Bundle with Web Cryptography API

# Usage

Fetch dependencies

```
bun install
```

or 

```
deno run -A deno_install.js
```
or 

```
npm install
```

Entry point is `src` directory, main script is `script.js`.

`assets` directory contains `manifest.webmanifest`, `index.html` and any other scripts or resources to be bundled.

# Build the Signed Web Bundle and Isolated Web App using Rollup

Write `signed.swbn` to current directory


Bun
```
bun run rollup.wbn.js
```

Deno
```
deno run --unstable-byonm -A rollup.wbn.js
```

Node.js 
```
node --experimental-default-type=module rollup.wbn.js
```

# Install Isolated Web App using Signed Web Bundle

Navigate to `chrome://web-app-internals/`, click `Select file...` and select `signed.swbn`.

# TODO

- This should work in the browser.

# License
[WTFPLv2](http://www.wtfpl.net/about/)
