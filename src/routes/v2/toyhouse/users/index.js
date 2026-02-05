const { Router } = require("express");
const router = Router();
const { join } = require("node:path");
const { firefox, devices } = require("playwright");
const fs = require("fs");

const { Cache } = require(join(__basedir, "utils", "cache"));
const RateLimit = require(join(__basedir, "utils", "rate-limit"));
// const { statusCodeHandler } = require(join(
//   __basedir,
//   "utils",
//   "status-code-handler"
// ));
const { responseHandler } = require(join(__basedir, "utils", "utils"));

const userCache = new Cache("toyhouse-users", 0, 60 * 60 * 24 * 1.5);

const limit = RateLimit(15, 50);

router.get("/:username", limit, async (req, res) => {
  let { username } = req.params;
  username = username.toLowerCase();

  let data = await userCache.get(username);

  if (data) {
    return responseHandler(req.headers.accept, res, data, "user");
  }
  // Launch broser headless
  const browser = await firefox.connect(
    process.env.BROWSER_PLAYWRIGHT_ENDPOINT
  );
  const context = await browser.newContext(devices["Desktop Firefox HiDPI"]);
  // Add cookies from process.env.TOYHOUSE_COOKIES
  const cookies = process.env.TOYHOUSE_COOKIES.split("=");
  await context.addCookies([
    {
      name: cookies[0],
      value: cookies[1],
      domain: "toyhou.se",
      path: "/",
    },
  ]);

  const page = await context.newPage();

  // Go to the page
  await page.goto(`https://toyhou.se/${username}`);

  // Wait for the page to load
  await page.waitForSelector(".profile-characters-content");

  // Make a file of the content of the page
  const content = await page.content();
  fs.writeFileSync("page.html", content);

  const name = await page.$eval(
    ".display-user > a > .display-user-username",
    (el) => el?.innerText || username
  );
  const avatarUrl = await page.$eval(
    ".display-user-avatar",
    (el) =>
      el?.src ||
      `https://f2.toyhou.se/file/f2-toyhou-se/users/${name}?${Date.now()}`
  );
  const avatarVersion = avatarUrl.split("?")[1];
  // Profile content is a html element
  const profileContent = await page
    .$eval(
      ".profile-section.profile-content-section.user-content",
      (el) => el.innerText
    )
    .catch(() => null);
  const profileContentHTML = await page
    .$eval(
      ".profile-section.profile-content-section.user-content",
      (el) => el.innerHTML
    )
    .catch(() => null);

  const characters = await page.$$eval(
    ".gallery-thumb.character-thumb",
    (elements) => {
      return elements.map((element) => {
        const name = element.querySelector(".thumb-character-name a").innerText;
        const url = element.querySelector(".thumb-image a").href;
        const id = url.split("/")[3].split(".")[0];
        const img =
          element.querySelector(".thumb-image img")?.src ||
          `https://f2.toyhou.se/file/f2-toyhou-se/characters/${id}?${Date.now()}`;
        const favorites =
          Number(
            element.querySelector(
              ".thumb-character-stat.favorites span.th-favorite-count"
            )?.innerText
          ) || 0;
        const images =
          Number(
            element.querySelector(".thumb-character-stat.images")?.innerText
          ) || 0;
        return {
          name,
          url,
          id,
          imageUrl: img,
          favoritesCount: favorites,
          imagesCount: images,
        };
      });
    }
  );
  const comments = await page.$$eval(".comment.forum-post", (elements) => {
    // Función recursiva para procesar comentarios y sus respuestas
    const processComment = (element) => {
      const contentElement = element.querySelector(".user-content");
      const content = contentElement
        ? contentElement.innerText
        : "Deleted content";

      // Obtener información del usuario (manejar cuentas eliminadas)
      let user = null;
      let avatar = null;
      const userBadge = element.querySelector(".forum-post-user-badge a");
      if (userBadge) {
        user = userBadge.innerText;
        avatar = element.querySelector(".forum-post-avatar img")?.src;
      }

      // Procesar fecha
      const timeElement = element.querySelector(".forum-post-time > abbr");
      const url = element.querySelector(".forum-post-permalink")?.href;
      let timeString = timeElement?.getAttribute("data-original-title") || "";
      if (timeString && !/[-+]\d{2}:\d{2}$/.test(timeString)) {
        timeString = `${timeString}-08:00`;
      }
      const time = timeString ? new Date(timeString) : new Date();

      // Procesar respuestas
      const repliesContainer = element.nextElementSibling?.classList.contains(
        "comment-replies"
      )
        ? element.nextElementSibling
        : null;

      const replies = repliesContainer
        ? Array.from(
            repliesContainer.querySelectorAll(".comment.forum-post")
          ).map(processComment)
        : [];

      return {
        user,
        avatarUrl: avatar,
        url,
        content: content.trim(),
        createdAt: time.toISOString(),
        createdAtTimestamp: time.getTime(),
        replies,
      };
    };

    return elements.map(processComment);
  });

  const bulletin = await page
    .$eval(".bulletin-wrapper", (element) => {
      const title = element.querySelector(".bulletin-title a").innerText;
      const url = element.querySelector(".bulletin-title a").href;
      const content = element.querySelector(".bulletin-post").innerText;
      const contentHTML = element.querySelector(".bulletin-post").innerHTML;
      const avatar = element.querySelector(".bulletin-header-avatar img").src;
      const user = element.querySelector(".bulletin-user-badge a").innerText;
      const timeElement = element.querySelector(".bulletin-time > abbr");
      let timeString = timeElement.getAttribute("data-original-title");
      // Asegúrate de que la cadena incluya el offset -08:00 si no está presente
      if (!/[-+]\d{2}:\d{2}$/.test(timeString)) {
        timeString = `${timeString}-08:00`;
      }
      const time = new Date(timeString);
      const createdAt = time.toISOString();
      const createdAtTimestamp = time.getTime();
      return {
        title,
        url,
        content,
        contentHTML,
        avatarUrl: avatar,
        user,
        createdAt,
        createdAtTimestamp,
      };
    })
    .catch(() => null);

  data = {
    id: username,
    name,
    avatarUrl,
    avatarVersion,
    profileContent,
    profileContentHTML,
    latestCharacters: characters,
    latestComments: comments,
    latestBulletin: bulletin,
  };

  await userCache.set(username, data);
  await browser.close();

  return responseHandler(req.headers.accept, res, data, "user");
});

module.exports = router;
