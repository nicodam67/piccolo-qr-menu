export function getMobileImageUrl(desktopUrl: string) {
  return desktopUrl.endsWith(".desktop.webp")
    ? desktopUrl.replace(/\.desktop\.webp$/, ".mobile.webp")
    : desktopUrl;
}
