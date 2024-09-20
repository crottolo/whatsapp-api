const qr = require('qr-image')
const { setupSession, deleteSession, reloadSession, validateSession, flushSessions, sessions } = require('../sessions')
const { sendErrorResponse, waitForNestedObject, setCustomWebhook, getCustomWebhook } = require('../utils')

/**
 * Starts a session for the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error starting the session.
 */
const startSession = async (req, res) => {
  // #swagger.summary = 'Start new session'
  // #swagger.description = 'Starts a session for the given session ID and optionally sets a custom webhook.'
  try {
    const sessionId = req.params.sessionId
    const { webhookURL } = req.query

    const setupSessionReturn = setupSession(sessionId)
    if (!setupSessionReturn.success) {
      /* #swagger.responses[422] = {
        description: "Unprocessable Entity.",
        content: {
          "application/json": {
            schema: { "$ref": "#/definitions/ErrorResponse" }
          }
        }
      }
      */
      sendErrorResponse(res, 422, setupSessionReturn.message)
      return
    }

    // Utilizziamo il webhook personalizzato se fornito, altrimenti usiamo quello predefinito
    const webhookToUse = webhookURL || process.env.BASE_WEBHOOK_URL

    if (webhookToUse) {
      const webhookSetSuccess = await setCustomWebhook(sessionId, webhookToUse)
      if (!webhookSetSuccess) {
        console.warn(`Failed to set webhook for session ${sessionId}`)
        // Continuiamo con l'avvio della sessione anche se l'impostazione del webhook fallisce
      }
    } else {
      console.warn(`No webhook URL provided for session ${sessionId}`)
    }

    /* #swagger.responses[200] = {
      description: "Status of the initiated session.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/StartSessionResponse" }
        }
      }
    }
    */
    // wait until the client is created
    waitForNestedObject(setupSessionReturn.client, 'pupPage')
      .then(() => {
        res.json({
          success: true,
          message: setupSessionReturn.message,
          webhookSet: !!webhookToUse
        })
      })
      .catch((err) => { sendErrorResponse(res, 500, err.message) })
  } catch (error) {
  /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('startSession ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Status of the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error getting status of the session.
 */
const statusSession = async (req, res) => {
  // #swagger.summary = 'Get session status'
  // #swagger.description = 'Status of the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const sessionData = await validateSession(sessionId)
    /* #swagger.responses[200] = {
      description: "Status of the session.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/StatusSessionResponse" }
        }
      }
    }
    */
    res.json(sessionData)
  } catch (error) {
    console.log('statusSession ERROR', error)
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * QR code of the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error getting status of the session.
 */
const sessionQrCode = async (req, res) => {
  // #swagger.summary = 'Get session QR code'
  // #swagger.description = 'QR code of the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const session = sessions.get(sessionId)
    if (!session) {
      return res.json({ success: false, message: 'session_not_found' })
    }
    if (session.qr) {
      return res.json({ success: true, qr: session.qr })
    }
    return res.json({ success: false, message: 'qr code not ready or already scanned' })
  } catch (error) {
    console.log('sessionQrCode ERROR', error)
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * QR code as image of the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error getting status of the session.
 */
const sessionQrCodeImage = async (req, res) => {
  // #swagger.summary = 'Get session QR code as image'
  // #swagger.description = 'QR code as image of the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const session = sessions.get(sessionId)
    if (!session) {
      return res.json({ success: false, message: 'session_not_found' })
    }
    if (session.qr) {
      const qrImage = qr.image(session.qr)
      /* #swagger.responses[200] = {
          description: "QR image.",
          content: {
            "image/png": {}
          }
        }
      */
      res.writeHead(200, {
        'Content-Type': 'image/png'
      })
      return qrImage.pipe(res)
    }
    return res.json({ success: false, message: 'qr code not ready or already scanned' })
  } catch (error) {
    console.log('sessionQrCodeImage ERROR', error)
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Restarts the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to terminate.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error terminating the session.
 */
const restartSession = async (req, res) => {
  // #swagger.summary = 'Restart session'
  // #swagger.description = 'Restarts the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const validation = await validateSession(sessionId)
    if (validation.message === 'session_not_found') {
      return res.json(validation)
    }
    await reloadSession(sessionId)
    /* #swagger.responses[200] = {
      description: "Sessions restarted.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/RestartSessionResponse" }
        }
      }
    }
    */
    res.json({ success: true, message: 'Restarted successfully' })
  } catch (error) {
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('restartSession ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Terminates the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to terminate.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error terminating the session.
 */
const terminateSession = async (req, res) => {
  // #swagger.summary = 'Terminate session'
  // #swagger.description = 'Terminates the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const validation = await validateSession(sessionId)
    if (validation.message === 'session_not_found') {
      return res.json(validation)
    }
    await deleteSession(sessionId, validation)
    /* #swagger.responses[200] = {
      description: "Sessions terminated.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/TerminateSessionResponse" }
        }
      }
    }
    */
    res.json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('terminateSession ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Terminates all inactive sessions.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error terminating the sessions.
 */
const terminateInactiveSessions = async (req, res) => {
  // #swagger.summary = 'Terminate inactive sessions'
  // #swagger.description = 'Terminates all inactive sessions.'
  try {
    await flushSessions(true)
    /* #swagger.responses[200] = {
      description: "Sessions terminated.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/TerminateSessionsResponse" }
        }
      }
    }
    */
    res.json({ success: true, message: 'Flush completed successfully' })
  } catch (error) {
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('terminateInactiveSessions ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Terminates all sessions.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error terminating the sessions.
 */
const terminateAllSessions = async (req, res) => {
  // #swagger.summary = 'Terminate all sessions'
  // #swagger.description = 'Terminates all sessions.'
  try {
    await flushSessions(false)
    /* #swagger.responses[200] = {
      description: "Sessions terminated.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/TerminateSessionsResponse" }
        }
      }
    }
    */
    res.json({ success: true, message: 'Flush completed successfully' })
  } catch (error) {
  /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('terminateAllSessions ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

const setWebhook = async (req, res) => {
  // #swagger.summary = 'Set custom webhook for session'
  // #swagger.description = 'Sets a custom webhook URL for the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const { webhookURL } = req.query

    if (!webhookURL) {
      return sendErrorResponse(res, 400, 'webhookURL is required')
    }

    const webhookSetSuccess = await setCustomWebhook(sessionId, webhookURL)
    if (webhookSetSuccess) {
      res.json({ success: true, message: 'Custom webhook set successfully' })
    } else {
      sendErrorResponse(res, 500, 'Failed to set custom webhook')
    }
  } catch (error) {
    console.log('setWebhook ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

const getWebhook = async (req, res) => {
  // #swagger.summary = 'Get current webhook URL for session'
  // #swagger.description = 'Retrieves the current webhook URL for the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const webhookURL = await getCustomWebhook(sessionId)

    if (webhookURL) {
      res.json({ success: true, webhookURL })
    } else {
      res.json({ success: true, message: 'No custom webhook set for this session', webhookURL: process.env.BASE_WEBHOOK_URL })
    }
  } catch (error) {
    console.log('getWebhook ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

module.exports = {
  startSession,
  statusSession,
  sessionQrCode,
  sessionQrCodeImage,
  restartSession,
  terminateSession,
  terminateInactiveSessions,
  terminateAllSessions,
  setWebhook,
  getWebhook
}
