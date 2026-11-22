'use strict';

const saveDataService = require('@services/savedata.service');
const { sendError, sendSuccess } = require('@utils/response.util');

exports.getSaveData = (req, res) => {
  try {
    if (!req.player) return sendError(res, 401, 'Unauthorized — invalid session');
    return sendSuccess(res, {
      saveData: saveDataService.getSaveData(req.player),
      session_token: req.player.session_token,
    });
  } catch (error) {
    console.error('[SaveData] get failed:', error);
    return sendError(res, 500, 'Internal server error');
  }
};

exports.saveSaveData = async (req, res) => {
  try {
    if (!req.player) return sendError(res, 401, 'Unauthorized — invalid session');

    // Accept the client's usual wrappers as well as a bare SaveData object.
    const payload = req.body?.saveData ?? req.body?.data ?? req.body?.SaveData ?? req.body;
    const result = await saveDataService.applySaveData(req.player, payload);

    return sendSuccess(res, {
      ...result,
      saveData: saveDataService.getSaveData(req.player),
      session_token: req.player.session_token,
    });
  } catch (error) {
    console.error('[SaveData] save failed:', error);
    const invalid = typeof error.message === 'string' && error.message.startsWith('Invalid save data');
    return sendError(res, invalid ? 400 : 500, invalid ? error.message : 'Internal server error');
  }
};
