const axios = require('axios')
const { globalApiKey, disabledCallbacks } = require('./config')
const fs = require('fs').promises
const path = require('path')

// Trigger webhook endpoint
const triggerWebhook = async (defaultWebhookURL, sessionId, dataType, data) => {
  const customWebhookURL = await getCustomWebhook(sessionId)
  const webhookURL = customWebhookURL || defaultWebhookURL

  axios.post(webhookURL, { dataType, data, sessionId }, { headers: { 'x-api-key': globalApiKey } })
    .catch(error => console.error('Failed to send webhook:', sessionId, dataType, error.message, data || ''))
}

// Function to send a response with error status and message
const sendErrorResponse = (res, status, message) => {
  res.status(status).json({ success: false, error: message })
}

// Function to wait for a specific item not to be null
const waitForNestedObject = (rootObj, nestedPath, maxWaitTime = 10000, interval = 100) => {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const checkObject = () => {
      const nestedObj = nestedPath.split('.').reduce((obj, key) => obj ? obj[key] : undefined, rootObj)
      if (nestedObj) {
        // Nested object exists, resolve the promise
        resolve()
      } else if (Date.now() - start > maxWaitTime) {
        // Maximum wait time exceeded, reject the promise
        console.log('Timed out waiting for nested object')
        reject(new Error('Timeout waiting for nested object'))
      } else {
        // Nested object not yet created, continue waiting
        setTimeout(checkObject, interval)
      }
    }
    checkObject()
  })
}

const checkIfEventisEnabled = (event) => {
  return new Promise((resolve, reject) => { if (!disabledCallbacks.includes(event)) { resolve() } })
}

const setCustomWebhook = async (sessionId, webhookURL) => {
  const sessionDir = path.join(__dirname, '..', 'sessions', `session-${sessionId}`)
  const webhookFile = path.join(sessionDir, 'webhook.txt')

  try {
    await fs.mkdir(sessionDir, { recursive: true })
    await fs.writeFile(webhookFile, webhookURL)
    console.log(`Custom webhook set for session ${sessionId}`)
    return true
  } catch (error) {
    console.error(`Failed to set custom webhook for session ${sessionId}:`, error)
    return false
  }
}

const getCustomWebhook = async (sessionId) => {
  const webhookFile = path.join(__dirname, '..', 'sessions', `session-${sessionId}`, 'webhook.txt')

  try {
    const webhookURL = await fs.readFile(webhookFile, 'utf-8')
    return webhookURL.trim()
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Error reading custom webhook for session ${sessionId}:`, error)
    }
    return null
  }
}

module.exports = {
  triggerWebhook,
  sendErrorResponse,
  waitForNestedObject,
  checkIfEventisEnabled,
  setCustomWebhook,
  getCustomWebhook
}
