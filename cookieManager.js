async function blockTrackingCookies(domain) {
  chrome.cookies.getAll({ domain }, (cookies) => {
    cookies.forEach(cookie => {
      if (!isEssential(cookie)) {
        chrome.cookies.remove({
          url: `https://${cookie.domain}${cookie.path}`,
          name: cookie.name
        });
        Logger.log(domain, `Removed cookie: ${cookie.name}`);
      }
    });
  });
}

function isEssential(cookie) {
  const essential = ["session_id", "preferences"];
  return essential.includes(cookie.name);
}
