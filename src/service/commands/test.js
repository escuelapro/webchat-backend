async function run(params, botHelper) {
  try {
    await botHelper.clearUnusedChats();
  } catch (e) {
    console.log(e);
  }
}

module.exports = { run };
