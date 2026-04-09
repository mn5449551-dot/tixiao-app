export function createRequestCoordinator() {
  let latestToken = 0;

  return {
    next() {
      latestToken += 1;
      return latestToken;
    },
    isLatest(token: number) {
      return token === latestToken;
    },
  };
}
