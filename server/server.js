const express = require('express')
const app = express()
require('dotenv').config()
const http = require('http')
const cors = require('cors')
const ACTIONS = require('./utils/actions')

// Models
const mongoose = require('mongoose')
const User = require('./models/User')
const Room = require('./models/Room')
const jwt = require('jsonwebtoken')

app.use(express.json())
app.use(cors())

const { Server } = require('socket.io')
const axios = require('axios')

const ML_AGENT_BASE_URL = process.env.ML_AGENT_URL || 'https://code-plag-fastapi.onrender.com'

// Simple in-memory generation queue (background worker)
const generationQueue = []
let generationProcessing = false

async function processGenerationQueue() {
	if (generationProcessing) return
	generationProcessing = true
	while (generationQueue.length) {
		const job = generationQueue.shift()
		const { roomId, language, questionId } = job
		try {
			const room = await Room.findOne({ roomId })
			if (!room) continue
			const existingGen = (room.generatedCodes || []).find(g => g.language === language && g.questionId?.toString() === questionId?.toString())
			if (existingGen) continue
			// find question by questionId
			const question = room.questions.find(q => q._id?.toString() === questionId?.toString())
			const questionText = question?.text || ''
			const genResp = await axios.post(`${ML_AGENT_BASE_URL}/generate`, { question: questionText, language }, { timeout: 60000 })
			if (genResp?.data?.generated_codes) {
				room.generatedCodes = room.generatedCodes || []
				room.generatedCodes.push({ language, questionId, generated_codes: genResp.data.generated_codes, generatedAt: new Date() })
				await room.save()
				// notify admin(s)
				const adminPart = room.participants.find((p) => p.userId?.toString() === room.admin.toString())
				if (adminPart && adminPart.socketId) {
					io.to(adminPart.socketId).emit(ACTIONS.ANALYSIS_COMPLETE, { type: 'generation_complete', language, questionId, generated_codes: genResp.data.generated_codes })
				}
			} else {
				// no generated_codes returned
				const adminPart = room.participants.find((p) => p.userId?.toString() === room.admin.toString())
				if (adminPart && adminPart.socketId) {
					io.to(adminPart.socketId).emit(ACTIONS.GENERATION_FAILED, { language, questionId, error: 'No generated code returned from ML agent' })
				}
			}
		} catch (err) {
			console.error('Background generation failed for', roomId, language, err?.message || err)
			// notify admin(s) about failure
			try {
				const room = await Room.findOne({ roomId })
				if (room) {
					const adminPart = room.participants.find((p) => p.userId?.toString() === room.admin.toString())
					if (adminPart && adminPart.socketId) {
						io.to(adminPart.socketId).emit(ACTIONS.GENERATION_FAILED, { language, questionId, error: err?.message || 'generation error' })
					}
				}
			} catch (emitErr) {
				console.error('Failed to emit generation failure', emitErr)
			}
		}
	}
	generationProcessing = false
}

function enqueueGeneration(roomId, language, questionId) {
	generationQueue.push({ roomId, language, questionId })
	// start worker (non-blocking)
	processGenerationQueue().catch(err => console.error('Generation worker error', err))
}

const server = http.createServer(app)
const io = new Server(server, {
	cors: {
		origin: '*',
	},
})

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeconnect'
mongoose
	.connect(MONGO_URI)
	.then(() => console.log('Connected to MongoDB'))
	.catch((err) => console.error('MongoDB connection error', err))

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret'

// helper: verify token and return user document
async function verifyToken(token) {
	if (!token) return null
	try {
		const payload = jwt.verify(token, JWT_SECRET)
		const user = await User.findById(payload.id).select('-password')
		return user
	} catch (err) {
		console.warn('verifyToken failed:', err.message)
		return null
	}
}

// helper endpoint to quickly validate a token (for debugging/auth checks)
app.post('/api/auth/verify', async (req, res) => {
	try {
		const token = req.headers.authorization?.split(' ')[1] || req.body?.token
		if (!token) return res.status(400).json({ error: 'token missing' })
		const user = await verifyToken(token)
		if (!user) return res.status(401).json({ error: 'invalid token' })
		res.json({ ok: true, user: { id: user._id, username: user.username, email: user.email } })
	} catch (err) {
		console.error('verify endpoint error', err)
		res.status(500).json({ error: 'server error' })
	}
})

// health check endpoint for ML agent availability
app.get('/api/health/ml-agent', async (req, res) => {
	try {
		// attempt a quick ping to the ML agent root endpoint
		const healthResp = await axios.get(`${ML_AGENT_BASE_URL}/`, { timeout: 5000 })
		if (healthResp.status === 200) {
			return res.json({ ok: true, mlAgentAvailable: true, message: 'ML agent is reachable' })
		}
	} catch (err) {
		console.warn('ML agent health check failed:', err?.message || err)
	}
	// ML agent unreachable
	return res.status(503).json({ ok: false, mlAgentAvailable: false, message: 'ML agent is not reachable' })
})

function generateId(len = 6) {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
	let out = ''
	for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
	return out
}

function generatePassword(len = 6) {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
	let out = ''
	for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
	return out
}

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
	try {
		const { username, email, password } = req.body
		if (!username || !email || !password) return res.status(400).json({ error: 'missing fields' })
		const existing = await User.findOne({ $or: [{ username }, { email }] })
		if (existing) return res.status(409).json({ error: 'user exists' })
		const user = await User.create({ username, email, password })
		const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' })
		res.json({ token, user: { id: user._id, username: user.username, email: user.email } })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'server error' })
	}
})

app.post('/api/auth/login', async (req, res) => {
	try {
		const { username, password } = req.body
		if (!username || !password) return res.status(400).json({ error: 'missing fields' })
		const user = await User.findOne({ username })
		if (!user) return res.status(401).json({ error: 'invalid credentials' })
		const ok = await user.comparePassword(password)
		if (!ok) return res.status(401).json({ error: 'invalid credentials' })
		const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' })
		res.json({ token, user: { id: user._id, username: user.username, email: user.email } })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'server error' })
	}
})

// Simple room fetch endpoint
app.get('/api/rooms/:roomId', async (req, res) => {
	try {
		const room = await Room.findOne({ roomId: req.params.roomId }).populate('admin', 'username')
		if (!room) return res.status(404).json({ error: 'not found' })
		res.json(room)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'server error' })
	}
})

// socket user map (keeps quick view for client-only features)
let userSocketMap = []

function getUsersInRoom(roomId) {
	return userSocketMap.filter((user) => user.roomId == roomId)
}

function getRoomId(socketId) {
	const user = userSocketMap.find((user) => user.socketId === socketId)
	return user?.roomId
}

io.on('connection', (socket) => {
	// create room (admin-only via auth)
	socket.on(ACTIONS.CREATE_ROOM, async ({ token }) => {
		try {
			const user = await verifyToken(token)
			if (!user) return io.to(socket.id).emit('error', { message: 'unauthorized' })
			const roomId = generateId(6)
			const password = generatePassword(8)
			const room = await Room.create({ roomId, password, admin: user._id, participants: [] })
			// add admin as participant
			room.participants.push({ userId: user._id, username: user.username, socketId: socket.id, online: true })
			await room.save()
			socket.join(roomId)
			io.to(socket.id).emit(ACTIONS.ROOM_CREATED, { roomId: room.roomId, password: room.password })
		} catch (err) {
			console.error(err)
			io.to(socket.id).emit('error', { message: 'create room failed' })
		}
	})

	// join room
	socket.on(ACTIONS.JOIN_ROOM, async ({ token, roomId, password }) => {
		try {
			const user = await verifyToken(token)
			if (!user) return io.to(socket.id).emit('error', { message: 'unauthorized' })
			const room = await Room.findOne({ roomId })
			if (!room) return io.to(socket.id).emit('error', { message: 'room not found' })
			if (room.password !== password) return io.to(socket.id).emit('error', { message: 'invalid password' })
			// update or add participant
			const existing = room.participants.find((p) => p.userId?.toString() === user._id.toString())
			if (existing) {
				existing.socketId = socket.id
				existing.online = true
			} else {
				room.participants.push({ userId: user._id, username: user.username, socketId: socket.id, online: true })
			}
			await room.save()
			socket.join(roomId)
			// maintain server-side quick map for other features
			userSocketMap.push({ username: user.username, roomId, status: ACTIONS.USER_ONLINE, cursorPosition: 0, typing: false, socketId: socket.id, currentFile: null })
			// notify others
			socket.broadcast.to(roomId).emit(ACTIONS.USER_JOINED, { username: user.username })
			const participants = room.participants.map((p) => ({ username: p.username, online: p.online, socketId: p.socketId }))
			const isAdmin = room.admin.toString() === user._id.toString()
			io.to(socket.id).emit(ACTIONS.JOIN_ACCEPTED, { roomId: room.roomId, participants, admin: room.admin.toString(), questions: room.questions || [], isAdmin })
		} catch (err) {
			console.error(err)
			io.to(socket.id).emit('error', { message: 'join failed' })
		}
	})

	// submit question (admin only)
	socket.on(ACTIONS.SUBMIT_QUESTION, async ({ token, roomId, questionText, languageHint }) => {
		try {
			const user = await verifyToken(token)
			if (!user) return io.to(socket.id).emit('error', { message: 'unauthorized' })
			const room = await Room.findOne({ roomId })
			if (!room) return io.to(socket.id).emit('error', { message: 'room not found' })
			if (room.admin.toString() !== user._id.toString()) return io.to(socket.id).emit('error', { message: 'admin only' })

			// create new question with MongoDB _id
			const newQuestion = {
				text: questionText,
				languageHint,
				createdAt: new Date()
			}
			// push question to questions array
			room.questions.push(newQuestion)
			// set this as current question
			room.currentQuestionId = room.questions[room.questions.length - 1]._id
			await room.save()

			// broadcast to all participants (candidates will display question)
			io.to(roomId).emit(ACTIONS.NEW_QUESTION, {
				question: room.questions[room.questions.length - 1],
				currentQuestionId: room.currentQuestionId
			})
		} catch (err) {
			console.error(err)
			io.to(socket.id).emit('error', { message: 'submit question failed' })
		}
	})

	// submit code (candidate)
	socket.on(ACTIONS.SUBMIT_CODE, async ({ token, roomId, language, code, questionId }) => {
		try {
			const user = await verifyToken(token)
			if (!user) return io.to(socket.id).emit('error', { message: 'unauthorized' })
			const room = await Room.findOne({ roomId })
			if (!room) return io.to(socket.id).emit('error', { message: 'room not found' })

			// Use provided questionId or fallback to current
			const targetQuestionId = questionId || room.currentQuestionId

			// push submission with questionId tracking
			const submission = {
				userId: user._id,
				username: user.username,
				language,
				code,
				status: 'pending',
				questionId: targetQuestionId,
				createdAt: new Date()
			}
			room.submissions.push(submission)
			await room.save()
			// notify admin(s) with full submission (includes code)
			const lastSub = room.submissions[room.submissions.length - 1]
			const adminPart = room.participants.find((p) => p.userId?.toString() === room.admin.toString())
			if (adminPart && adminPart.socketId) {
				io.to(adminPart.socketId).emit(ACTIONS.SUBMISSION_RECEIVED, { submission: { id: lastSub._id, userId: lastSub.userId, username: lastSub.username, language: lastSub.language, code: lastSub.code, createdAt: lastSub.createdAt, questionId: lastSub.questionId } })
			}

			// enqueue generation job if codes for this language don't exist for current question
			try {
				const existingGen = (room.generatedCodes || []).find(g => g.language === language && g.questionId?.toString() === room.currentQuestionId?.toString())
				if (!existingGen) {
					enqueueGeneration(room.roomId, language, room.currentQuestionId)
				}
			} catch (genErr) {
				console.error('Enqueue generation failed:', genErr?.message || genErr)
			}
			io.to(socket.id).emit('submitted', { ok: true })
		} catch (err) {
			console.error(err)
			io.to(socket.id).emit('error', { message: 'submit failed' })
		}
	})

	socket.on('disconnecting', () => {
		const user = userSocketMap.find((user) => user.socketId === socket.id)
		const roomId = user?.roomId
		if (roomId === undefined || user === undefined) return
		socket.broadcast.to(roomId).emit(ACTIONS.USER_DISCONNECTED, { user })
		userSocketMap = userSocketMap.filter((u) => u.socketId !== socket.id)
		socket.leave()
	})

	// keep existing handlers for file sync and others
	socket.on(ACTIONS.SYNC_FILES, ({ files, currentFile, socketId }) => {
		io.to(socketId).emit(ACTIONS.SYNC_FILES, {
			files,
			currentFile,
		})
	})

	// Admin requests analysis for a specific submission
	socket.on(ACTIONS.REQUEST_ANALYSIS, async ({ token, roomId, submissionId }) => {
		try {
			const user = await verifyToken(token)
			if (!user) return io.to(socket.id).emit('error', { message: 'unauthorized' })
			const room = await Room.findOne({ roomId })
			if (!room) return io.to(socket.id).emit('error', { message: 'room not found' })
			if (room.admin.toString() !== user._id.toString()) return io.to(socket.id).emit('error', { message: 'admin only' })
			const submission = room.submissions.id(submissionId)
			if (!submission) return io.to(socket.id).emit('error', { message: 'submission not found' })

			// Check if analysis is already cached
			if (submission.analysis) {
				console.log(`Returning cached analysis for submission ${submissionId}`)
				return io.to(socket.id).emit(ACTIONS.ANALYSIS_COMPLETE, { submissionId, analysis: submission.analysis })
			}

			// find generated codes for this language AND specific question
			const gen = (room.generatedCodes || []).find(g =>
				g.language === submission.language &&
				g.questionId?.toString() === submission.questionId?.toString()
			)

			if (!gen) return io.to(socket.id).emit('error', { message: 'generated code not available for this question/language' })
			// call analyze endpoint
			try {
				const analyzeResp = await axios.post(`${ML_AGENT_BASE_URL}/analyze`, {
					question: room.question?.text || '',
					language: submission.language,
					user_code: submission.code,
					gemini_code: gen.generated_codes.gemini || gen.generated_codes.original || '',
					chatgpt_code: gen.generated_codes.chatgpt || '',
					claude_code: gen.generated_codes.claude || '',
				}, { timeout: 120000 })
				if (analyzeResp?.data) {
					// Normalize response: ensure 'gemini' key exists if 'original' is present
					if (analyzeResp.data.generated_codes && analyzeResp.data.generated_codes.original && !analyzeResp.data.generated_codes.gemini) {
						analyzeResp.data.generated_codes.gemini = analyzeResp.data.generated_codes.original;
					}
					// Normalize similar_lines keys if needed (e.g. original_vs_user -> gemini_vs_user)
					if (analyzeResp.data.similar_lines) {
						if (analyzeResp.data.similar_lines.original_vs_user && !analyzeResp.data.similar_lines.gemini_vs_user) {
							analyzeResp.data.similar_lines.gemini_vs_user = analyzeResp.data.similar_lines.original_vs_user;
						}
					}

					// store analysis inside submission
					submission.analysis = analyzeResp.data
					submission.status = 'analyzed'
					await room.save()
					// emit analysis result back to admin who requested it
					io.to(socket.id).emit(ACTIONS.ANALYSIS_COMPLETE, { submissionId, analysis: analyzeResp.data })
				}
			} catch (err) {
				console.error('Analysis failed', err?.message || err)
				io.to(socket.id).emit('error', { message: 'analysis failed' })
			}
		} catch (err) {
			console.error(err)
			io.to(socket.id).emit('error', { message: 'request analysis failed' })
		}
	})

	// Admin requests manual generation for a language
	socket.on(ACTIONS.REQUEST_GENERATE, async ({ token, roomId, language }) => {
		try {
			const user = await verifyToken(token)
			if (!user) return io.to(socket.id).emit('error', { message: 'unauthorized' })
			const room = await Room.findOne({ roomId })
			if (!room) return io.to(socket.id).emit('error', { message: 'room not found' })
			if (room.admin.toString() !== user._id.toString()) return io.to(socket.id).emit('error', { message: 'admin only' })
			// enqueue generation for current question
			enqueueGeneration(room.roomId, language, room.currentQuestionId)
			// notify requester that generation was queued
			io.to(socket.id).emit(ACTIONS.ANALYSIS_COMPLETE, { type: 'generation_queued', language, questionId: room.currentQuestionId })
		} catch (err) {
			console.error('Request generate failed', err)
			io.to(socket.id).emit('error', { message: 'request generate failed' })
		}
	})

	// Admin ends the room (closes it and deletes from DB)
	socket.on(ACTIONS.END_ROOM, async ({ token, roomId }) => {
		try {
			const user = await verifyToken(token)
			if (!user) return io.to(socket.id).emit('error', { message: 'unauthorized' })
			const room = await Room.findOne({ roomId })
			if (!room) return io.to(socket.id).emit('error', { message: 'room not found' })
			if (room.admin.toString() !== user._id.toString()) return io.to(socket.id).emit('error', { message: 'admin only' })
			// delete room from database
			await Room.deleteOne({ _id: room._id })
			// notify all participants in the room that it's closed
			io.to(roomId).emit(ACTIONS.ROOM_CLOSED, { message: 'Room has been closed by the admin' })
			// leave and disconnect participants from the room
			io.in(roomId).disconnectSockets()
		} catch (err) {
			console.error('End room failed', err)
			io.to(socket.id).emit('error', { message: 'end room failed' })
		}
	})

	socket.on(ACTIONS.FILE_CREATED, ({ file }) => {
		const roomId = getRoomId(socket.id)
		socket.broadcast.to(roomId).emit(ACTIONS.FILE_CREATED, { file })
	})

	socket.on(ACTIONS.FILE_UPDATED, ({ file }) => {
		const roomId = getRoomId(socket.id)
		socket.broadcast.to(roomId).emit(ACTIONS.FILE_UPDATED, { file })
	})

	socket.on(ACTIONS.FILE_RENAMED, ({ file }) => {
		const roomId = getRoomId(socket.id)
		socket.broadcast.to(roomId).emit(ACTIONS.FILE_RENAMED, { file })
	})

	socket.on(ACTIONS.FILE_DELETED, ({ id }) => {
		const roomId = getRoomId(socket.id)
		socket.broadcast.to(roomId).emit(ACTIONS.FILE_DELETED, { id })
	})

	// Handle user status
	socket.on(ACTIONS.USER_OFFLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: ACTIONS.USER_OFFLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		socket.broadcast.to(roomId).emit(ACTIONS.USER_OFFLINE, { socketId })
	})

	socket.on(ACTIONS.USER_ONLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: ACTIONS.USER_ONLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		socket.broadcast.to(roomId).emit(ACTIONS.USER_ONLINE, { socketId })
	})

	// Handle chat actions
	socket.on(ACTIONS.SEND_MESSAGE, ({ message }) => {
		const roomId = getRoomId(socket.id)
		socket.broadcast.to(roomId).emit(ACTIONS.RECEIVE_MESSAGE, { message })
	})

	// Handle cursor position
	socket.on(ACTIONS.TYPING_START, ({ cursorPosition }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: true, cursorPosition }
			}
			return user
		})
		const user = userSocketMap.find((user) => user.socketId === socket.id)
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(ACTIONS.TYPING_START, { user })
	})

	socket.on(ACTIONS.TYPING_PAUSE, () => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: false }
			}
			return user
		})
		const user = userSocketMap.find((user) => user.socketId === socket.id)
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(ACTIONS.TYPING_PAUSE, { user })
	})

	socket.on(ACTIONS.REQUEST_DRAWING, () => {
		const roomId = getRoomId(socket.id)
		socket.broadcast
			.to(roomId)
			.emit(ACTIONS.REQUEST_DRAWING, { socketId: socket.id })
	})

	socket.on(ACTIONS.SYNC_DRAWING, ({ drawingData, socketId }) => {
		socket.broadcast
			.to(socketId)
			.emit(ACTIONS.SYNC_DRAWING, { drawingData })
	})

	socket.on(ACTIONS.DRAWING_UPDATE, ({ snapshot }) => {
		const roomId = getRoomId(socket.id)
		socket.broadcast.to(roomId).emit(ACTIONS.DRAWING_UPDATE, {
			snapshot,
		})
	})
})

const PORT = process.env.PORT || 3000

app.get('/', (req, res) => {
	res.send('API is running successfully')
})

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`)
})
