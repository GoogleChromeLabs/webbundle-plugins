# How to Contribute

We'd love to accept your patches and contributions to this project. There are
just a few small guidelines you need to follow.

## Contributor License Agreement

Contributions to this project must be accompanied by a Contributor License
Agreement. You (or your employer) retain the copyright to your contribution;
this simply gives us permission to use and redistribute your contributions as
part of the project. Head over to <https://cla.developers.google.com/> to see
your current agreements on file or to sign a new one.

You generally only need to submit a CLA once, so if you've already submitted one
(even if it was for a different project), you probably don't need to do it
again.

## Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Community Guidelines

This project follows
[Google's Open Source Community Guidelines](https://opensource.google/conduct/).

## Auto-formatting code

The Github Actions workflow enforces linting code with Prettier according to the
Prettier configs specified in the package.json.

To lint your code locally before committing, one can run `npm run lint`.

To enable running Prettier on save with VSCode, one can install the Prettier
extension and then in VScode's settings have the following entries:

```json
"editor.formatOnSave": true,
"[javascript]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```
