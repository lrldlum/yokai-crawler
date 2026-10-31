# Yokai Crawler

A browser action game on a night road in feudal Japan. Kaede (and, if you share a road, Shio) walk from a cedar shrine to an oni gate, cutting through kappa, tengu, jorogumo, and the gate oni. The camera sits high and a little behind you, the way a tabletop diorama reads: dark cedars and lanterns, then bright ofuda light when a fight starts.

It is a static site. Open `index.html`, or play it at <https://lrldlum.github.io/yokai-crawler/>. Nothing is installed to play.

Publishing is the Pages workflow on `main` (`.github/workflows/pages.yml`). The first time, the repository has to allow that: Settings → Pages → Build and deployment → Source: **GitHub Actions**. After that, every push to `main` deploys. Re-run the "Deploy Pages" workflow if the first attempt ran before Pages was turned on.

The road is original fiction. It is not affiliated with any other game, and it does not use anyone else's art or names.

## Play

| Action | Key |
|---|---|
| Move | WASD or arrow keys |
| Aim | Mouse (you also face the way you are walking) |
| Katana chain | J or left click, hold to keep swinging |
| Ofuda stream | Hold K or right click. Spends spirit. |
| Dash | Shift. A short step with a moment of safety. |
| Warding seal | Space. A ring around you. Spends spirit. |
| Kunai | Q |
| Elixir | F. You carry a few. |
| Rest, or lift a fallen companion | E, at a shrine or beside them |
| Pause | Esc. On a shared road, only the host can pause. |
| Mute | M |

On a phone, a stick and five buttons appear (斬 slash, 符 ofuda, 駆 dash, 封 seal, 癒 elixir).

Fight in bursts. Walk the lanterns between them. Shrines refill vitality, spirit, and elixirs. Koban and spirit motes pull toward you. The road ends when the gate court goes quiet.

## Play together

The host simulates the whole road. The other player only sends what they press, and the host sends the world back. Signalling uses the public PeerJS broker; the game itself is peer to peer. Strict networks without a working peer connection can fail, the same way any WebRTC page can. There is no account and no server to join.

1. One person chooses **Host a road**.
2. A four-character code appears, with a link.
3. Send the code, or **Copy share link**.
4. The other person opens the link, or chooses **Join with a code** and types it.
5. The host chooses **Begin the road**. A companion can also arrive after the walk has started.
6. You are Kaede (vermilion) and Shio (teal). Enemy vitality is shared. Either of you can rest at a shrine, and either can press E beside the other to lift them.

**Walk alone** never opens a room.

## Local page

Any static file server works. From this folder:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

The co-op check (two headless browsers, one hosts, one joins, both move, both see a yokai lose vitality) is:

```bash
npm install
npx playwright install chromium
npm run test:coop
```

A local PeerJS broker is optional. Add `?peerhost=127.0.0.1&peerport=9000` if you run one. The public site does not need that.
