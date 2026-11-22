const router = require('express').Router();
const authController = require('@controllers/auth.controller');
const saveDataController = require('@controllers/savedata.controller');

router.post('/authen', authController.authenticate.bind(authController));

// Progression SaveData. Mounted under /live/player by routes/index.js.
router.post('/savedata/get', authController.verifySession.bind(authController), saveDataController.getSaveData);
router.post('/savedata/save', authController.verifySession.bind(authController), saveDataController.saveSaveData);

module.exports = router;
