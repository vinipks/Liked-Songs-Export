import express from "express";
import SpotifyWebApi from "spotify-web-api-node";

const app = express();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI
});

app.get("/login", (req, res) => {
  const scopes = ["user-library-read", "playlist-modify-private"];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, "state123");
  res.redirect(authorizeURL);
});

app.get("/api/callback", async (req, res) => {
  try {
    const { code } = req.query;
    const data = await spotifyApi.authorizationCodeGrant(code);
    spotifyApi.setAccessToken(data.body["access_token"]);
    spotifyApi.setRefreshToken(data.body["refresh_token"]);

    // get liked songs
    let results = [];
    let offset = 0;
    while (true) {
      const tracks = await spotifyApi.getMySavedTracks({ limit: 50, offset });
      results.push(...tracks.body.items);
      if (tracks.body.items.length < 50) break;
      offset += 50;
    }

    // order oldest first
    const trackIds = results.reverse().map(item => item.track.id);

    // create playlist
    const me = await spotifyApi.getMe();
    const playlist = await spotifyApi.createPlaylist(me.body.id, "Liked Songs (Ordered Copy)", {
      public: false
    });

    for (let i = 0; i < trackIds.length; i += 100) {
      await spotifyApi.addTracksToPlaylist(
        playlist.body.id,
        trackIds.slice(i, i + 100).map(id => `spotify:track:${id}`)
      );
    }

    res.send(`✅ Playlist created: <a href="${playlist.body.external_urls.spotify}">Open on Spotify</a>`);
  } catch (err) {
    console.error(err);
    res.send("Something went wrong");
  }
});

export default app;
