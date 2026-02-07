# Cloud Minigame Deployment Guide

This project loads extra minigames from the cloud at runtime.

Local game shell behavior:
1. Always boots with local games.
2. If there is internet connectivity, then it fetches cloud manifest from `src/cloud-games-loader.js` (`MANIFEST_URL`).
3. Loads only cloud game scripts whose URL starts with `ALLOWED_PREFIX` in `cloud-games-loader.js`.

## 1) AWS setup

### Login to AWS on CLI (username and password is in the Slack)

IMPORTANT INFO - 
BUCKET NAME: noodleheads-tartanhacks
CDN-DOMAIN: d34anrzmbcnfx3.cloudfront.net
DIST ID: E1AM8Q9K3TIXZL

Current CORS Settings (Let me know if you need me to change)
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "http://localhost:8000",
        "http://127.0.0.1:8000"
      ],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}

## 2) Create a new cloud minigame file

This is what ChatGPT said: 
-------------------------------------------------------------------------------
Supposedly it is like this: 
Use this path pattern:
`cloud/games/<game-id>/<script-name>.cloud.js`

Example:
`cloud/games/vanish/minigame-vanishing.cloud.js`

Your script must call `window.registerCloudMiniGame(...)` and return a game object:
```js
window.registerCloudMiniGame(function () {
  return {
    id: "my-cloud-game",
    label: "My Cloud Game",
    weight: 1,
    playable: true,
    render: function (mount, ctx) {
      // game UI + logic
      // call ctx.onSuccess() when complete
      return function cleanup() {};
    }
  };
});
```

Important:
1. `id` should be unique across local and cloud games.
2. `render` must exist.
3. Call `ctx.onSuccess()` on win so scoring/session flow works.
-------------------------------------------------------------------------------

But you can pretty much implement a game like how we implement all the others, get chatgpt to add another minigame in src/ like minigame-something.js, then upload it onto cloud with below. 

Do note that erm currently I am still doing jank game's display settings are still in index.html bc it's lowkey easier to implement like that. So each new game still adds a little bit of storage bc those style settings are saved. 

## 3) Deploy the new game

Use `deploy-cloud-game.sh` (non-versioned path; overwrites one live file).

```sh
./deploy-cloud-game.sh \
  --game-id <game-id> \
  --source src/<script-name>.js \
  --cdn-domain d34anrzmbcnfx3.cloudfront.net \
  --bucket noodleheads-tartanhacks \
  --dist-id E1AM8Q9K3TIXZL
```
game-id can be anything you want (like for the vanishing tiles, the name is vanish)

What this script does:
1. Copies source into `cloud/games/<game-id>/<script-name>` if needed.
2. Updates `cloud/manifest.json` entry for `<game-id>`.
3. Uploads script and manifest to S3:
   - `games/<game-id>/<script-name>`
   - `games/manifest.json`
4. Invalidates CloudFront for manifest and script path.

Dry run:
```sh
./deploy-cloud-game.sh --dry-run
```

## 4) Local verification

1. Rebuild local archive:
```sh
sh compress.sh
```
2. Run:
```sh
sh run.sh src.tar.br
```
3. Open:
`http://localhost:8000/src/index.html`
4. Check browser console:
```js
window.CloudGamesStatus
```

Success indicators: (this can be seen in developer console)
1. `state: "ready"`
2. `allowedEntries > 0`
3. `loadedScripts > 0`

