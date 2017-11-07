export const log = (message, data) => logger("LOGGER", message, data);
// sometimes we want a message to accompany the error
export const logErr = (message, err) => logger("ERROR", message, err);

const logger = (prefix, message, data) => {
  if (message) console.log(`${prefix}: ${message}`);
  if (data) {
    console.log(
      `${prefix}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
    );
  }
};
