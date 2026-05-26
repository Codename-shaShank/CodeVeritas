/**
 * ═══════════════════════════════════════════════════════════════════
 *  CodeVeritas — Judge Worker
 *  Sandboxed Code Execution Microservice
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Flow:  Kafka (consume) → Docker sandbox → Redis (publish)
 *
 *  Supported languages:
 *    • JavaScript  → node:20-alpine
 *    • C / C++     → gcc:13-alpine
 *
 *  Verdicts:
 *    AC  — Accepted (exit 0, clean stdout)
 *    WA  — Wrong Answer (exit 0 but stderr present)
 *    TLE — Time Limit Exceeded (timeout kill)
 *    MLE — Memory Limit Exceeded (OOM kill, exit 137)
 *    CE  — Compilation Error (compile step failed)
 *    RE  — Runtime Error (non-zero exit, not TLE/MLE)
 *
 * ═══════════════════════════════════════════════════════════════════
 */

const { Kafka, logLevel } = require('kafkajs')
const Redis = require('ioredis')
const Docker = require('dockerode')
const { v4: uuidv4 } = require('uuid')
const os = require('os')
const fs = require('fs')
const path = require('path')

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const CONFIG = {
	kafka: {
		brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
		groupId: process.env.KAFKA_GROUP_ID || 'judge-workers',
		taskTopic: 'code-execution-tasks',
	},
	redis: {
		host: process.env.REDIS_HOST || 'localhost',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		statusChannel: 'code-execution-status',
		resultChannel: 'code-execution-results',
	},
	execution: {
		timeoutMs: 5000,          // 5-second hard wall-clock timeout
		cpuTimeLimitMs: 2000,     // 2-second CPU time limit
		memoryLimitBytes: 256 * 1024 * 1024,  // 256 MB
		pidsLimit: 64,
		tmpDir: path.join(os.tmpdir(), 'codeveritas-judge'),
	},
	docker: {
		images: {
			javascript: 'node:20-alpine',
			c: 'gcc:13-alpine',
			cpp: 'gcc:13-alpine',
		},
	},
}

// ─────────────────────────────────────────────
// Language aliases → canonical name
// ─────────────────────────────────────────────

const LANGUAGE_ALIASES = {
	javascript: 'javascript',
	js: 'javascript',
	node: 'javascript',
	'node.js': 'javascript',
	c: 'c',
	cpp: 'cpp',
	'c++': 'cpp',
	'c plus plus': 'cpp',
}

function resolveLanguage(lang) {
	if (!lang) return null
	const normalized = lang.toLowerCase().trim()
	return LANGUAGE_ALIASES[normalized] || null
}

// ─────────────────────────────────────────────
// Initialize clients
// ─────────────────────────────────────────────

const kafka = new Kafka({
	clientId: `judge-worker-${os.hostname()}-${process.pid}`,
	brokers: CONFIG.kafka.brokers,
	logLevel: logLevel.WARN,
	retry: {
		initialRetryTime: 1000,
		retries: 10,
	},
})

const consumer = kafka.consumer({
	groupId: CONFIG.kafka.groupId,
	sessionTimeout: 30000,
	heartbeatInterval: 3000,
})

const redisPublisher = new Redis({
	host: CONFIG.redis.host,
	port: CONFIG.redis.port,
	maxRetriesPerRequest: 3,
	lazyConnect: true,
})

const docker = new Docker()

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

function ensureDir(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
}

function cleanupDir(dir) {
	try {
		if (fs.existsSync(dir)) {
			fs.rmSync(dir, { recursive: true, force: true })
		}
	} catch (err) {
		console.warn(`[cleanup] Failed to remove ${dir}:`, err.message)
	}
}

/**
 * Publish a status update to Redis for the gateway server to relay via Socket.io
 */
async function publishStatus(submissionId, socketId, roomId, stage, extra = {}) {
	const payload = JSON.stringify({
		submissionId,
		socketId,
		roomId,
		stage,
		timestamp: Date.now(),
		...extra,
	})
	try {
		await redisPublisher.publish(CONFIG.redis.statusChannel, payload)
	} catch (err) {
		console.error(`[redis] Failed to publish status for ${submissionId}:`, err.message)
	}
}

/**
 * Publish final execution result to Redis
 */
async function publishResult(submissionId, socketId, roomId, verdict, stdout, stderr, executionTimeMs) {
	const payload = JSON.stringify({
		submissionId,
		socketId,
		roomId,
		verdict,
		stdout: (stdout || '').substring(0, 50000),  // Cap output at 50KB
		stderr: (stderr || '').substring(0, 10000),   // Cap stderr at 10KB
		executionTimeMs,
		timestamp: Date.now(),
	})
	try {
		await redisPublisher.publish(CONFIG.redis.resultChannel, payload)
	} catch (err) {
		console.error(`[redis] Failed to publish result for ${submissionId}:`, err.message)
	}
}

/**
 * Collect all output from a Docker container stream (demuxed)
 */
function collectStream(stream) {
	return new Promise((resolve) => {
		const stdoutChunks = []
		const stderrChunks = []

		stream.on('data', (chunk) => {
			// Docker multiplexed streams have an 8-byte header
			// Header: [stream_type(1) | 0(3) | size(4)]
			// stream_type: 1 = stdout, 2 = stderr
			if (chunk.length > 8) {
				const streamType = chunk[0]
				const payload = chunk.slice(8)
				if (streamType === 1) {
					stdoutChunks.push(payload)
				} else if (streamType === 2) {
					stderrChunks.push(payload)
				} else {
					// Raw stream (tty mode) — treat as stdout
					stdoutChunks.push(payload)
				}
			} else {
				// Fallback: treat as raw stdout
				stdoutChunks.push(chunk)
			}
		})

		stream.on('end', () => {
			resolve({
				stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
				stderr: Buffer.concat(stderrChunks).toString('utf-8'),
			})
		})

		stream.on('error', (err) => {
			resolve({
				stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
				stderr: `Stream error: ${err.message}`,
			})
		})
	})
}

/**
 * Run a Docker container with resource limits and a hard timeout.
 * Returns { stdout, stderr, exitCode, timedOut, oomKilled }
 */
async function runContainer(image, cmd, workdir, binds, stdinData, timeoutMs) {
	let container = null
	let timedOut = false
	let timeoutHandle = null

	try {
		container = await docker.createContainer({
			Image: image,
			Cmd: cmd,
			WorkingDir: workdir,
			AttachStdout: true,
			AttachStderr: true,
			AttachStdin: !!stdinData,
			OpenStdin: !!stdinData,
			StdinOnce: true,
			Tty: false,
			HostConfig: {
				Binds: binds,
				Memory: CONFIG.execution.memoryLimitBytes,
				MemorySwap: CONFIG.execution.memoryLimitBytes, // No swap
				NanoCpus: 2e9,          // 2 CPU-seconds worth of CPU time
				PidsLimit: CONFIG.execution.pidsLimit,
				NetworkMode: 'none',    // No network access in sandbox
				AutoRemove: false,      // We inspect first, then remove
				ReadonlyRootfs: false,   // Need /tmp for compilation
			},
		})

		// Attach to container streams BEFORE starting
		const stream = await container.attach({
			stream: true,
			stdout: true,
			stderr: true,
			stdin: !!stdinData,
		})

		// Start the container
		await container.start()

		// Write stdin if provided
		if (stdinData && stream.writable) {
			stream.write(stdinData)
			stream.end()
		}

		// Set hard wall-clock timeout
		const timeoutPromise = new Promise((resolve) => {
			timeoutHandle = setTimeout(async () => {
				timedOut = true
				try {
					await container.stop({ t: 0 })
				} catch (stopErr) {
					// Container may have already exited
				}
				resolve()
			}, timeoutMs)
		})

		// Collect output
		const outputPromise = collectStream(stream)

		// Wait for container to finish OR timeout
		const waitPromise = container.wait()

		await Promise.race([
			waitPromise,
			timeoutPromise,
		])

		// Clear timeout if container finished first
		if (timeoutHandle) clearTimeout(timeoutHandle)

		// Get the outputs
		const output = await outputPromise

		// Inspect container state for exit code and OOM
		const inspectData = await container.inspect()
		const exitCode = inspectData.State.ExitCode
		const oomKilled = inspectData.State.OOMKilled || false

		return {
			stdout: output.stdout,
			stderr: output.stderr,
			exitCode,
			timedOut,
			oomKilled,
		}
	} finally {
		// Always cleanup container
		if (container) {
			try {
				await container.remove({ force: true })
			} catch (removeErr) {
				// Container may already be removed by AutoRemove
			}
		}
	}
}

// ─────────────────────────────────────────────
// Language-specific execution strategies
// ─────────────────────────────────────────────

/**
 * Execute JavaScript code in a Node.js Alpine container
 */
async function executeJavaScript(code, input, submissionId, socketId, roomId) {
	const taskDir = path.join(CONFIG.execution.tmpDir, submissionId)
	ensureDir(taskDir)

	try {
		// Write source file
		const sourceFile = path.join(taskDir, 'solution.js')
		fs.writeFileSync(sourceFile, code, 'utf-8')

		// Status: running (no compile step for JS)
		await publishStatus(submissionId, socketId, roomId, 'running')

		const startTime = Date.now()
		const result = await runContainer(
			CONFIG.docker.images.javascript,
			['node', '/sandbox/solution.js'],
			'/sandbox',
			[`${taskDir}:/sandbox:ro`],
			input || null,
			CONFIG.execution.timeoutMs
		)
		const executionTimeMs = Date.now() - startTime

		return { ...result, executionTimeMs }
	} finally {
		cleanupDir(taskDir)
	}
}

/**
 * Execute C code in a GCC Alpine container (compile + run)
 */
async function executeC(code, input, submissionId, socketId, roomId) {
	const taskDir = path.join(CONFIG.execution.tmpDir, submissionId)
	ensureDir(taskDir)

	try {
		// Write source file
		const sourceFile = path.join(taskDir, 'solution.c')
		fs.writeFileSync(sourceFile, code, 'utf-8')

		// ── Compile step ──
		await publishStatus(submissionId, socketId, roomId, 'compiling')

		const compileResult = await runContainer(
			CONFIG.docker.images.c,
			['gcc', '-O2', '-o', '/sandbox/solution', '/sandbox/solution.c', '-lm'],
			'/sandbox',
			[`${taskDir}:/sandbox`],   // rw for output binary
			null,
			15000  // 15s compile timeout (generous for cold start)
		)

		if (compileResult.exitCode !== 0) {
			return {
				stdout: '',
				stderr: compileResult.stderr || compileResult.stdout || 'Compilation failed',
				exitCode: compileResult.exitCode,
				timedOut: false,
				oomKilled: false,
				compilationError: true,
				executionTimeMs: 0,
			}
		}

		// ── Run step ──
		await publishStatus(submissionId, socketId, roomId, 'running')

		const startTime = Date.now()
		const runResult = await runContainer(
			CONFIG.docker.images.c,
			['/sandbox/solution'],
			'/sandbox',
			[`${taskDir}:/sandbox:ro`],
			input || null,
			CONFIG.execution.timeoutMs
		)
		const executionTimeMs = Date.now() - startTime

		return { ...runResult, compilationError: false, executionTimeMs }
	} finally {
		cleanupDir(taskDir)
	}
}

/**
 * Execute C++ code in a GCC Alpine container (compile + run)
 */
async function executeCpp(code, input, submissionId, socketId, roomId) {
	const taskDir = path.join(CONFIG.execution.tmpDir, submissionId)
	ensureDir(taskDir)

	try {
		// Write source file
		const sourceFile = path.join(taskDir, 'solution.cpp')
		fs.writeFileSync(sourceFile, code, 'utf-8')

		// ── Compile step ──
		await publishStatus(submissionId, socketId, roomId, 'compiling')

		const compileResult = await runContainer(
			CONFIG.docker.images.cpp,
			['g++', '-O2', '-std=c++17', '-o', '/sandbox/solution', '/sandbox/solution.cpp'],
			'/sandbox',
			[`${taskDir}:/sandbox`],   // rw for output binary
			null,
			15000  // 15s compile timeout
		)

		if (compileResult.exitCode !== 0) {
			return {
				stdout: '',
				stderr: compileResult.stderr || compileResult.stdout || 'Compilation failed',
				exitCode: compileResult.exitCode,
				timedOut: false,
				oomKilled: false,
				compilationError: true,
				executionTimeMs: 0,
			}
		}

		// ── Run step ──
		await publishStatus(submissionId, socketId, roomId, 'running')

		const startTime = Date.now()
		const runResult = await runContainer(
			CONFIG.docker.images.cpp,
			['/sandbox/solution'],
			'/sandbox',
			[`${taskDir}:/sandbox:ro`],
			input || null,
			CONFIG.execution.timeoutMs
		)
		const executionTimeMs = Date.now() - startTime

		return { ...runResult, compilationError: false, executionTimeMs }
	} finally {
		cleanupDir(taskDir)
	}
}

// Execution strategy map
const EXECUTORS = {
	javascript: executeJavaScript,
	c: executeC,
	cpp: executeCpp,
}

// ─────────────────────────────────────────────
// Verdict parser
// ─────────────────────────────────────────────

/**
 * Determine the verdict from execution results.
 *
 * Priority order:
 *   1. CE  — compilation failed (compile-step only)
 *   2. TLE — wall-clock timeout triggered
 *   3. MLE — OOM killed (exit 137 + OOMKilled flag)
 *   4. RE  — non-zero exit (runtime crash, signal)
 *   5. AC  — clean exit with output
 */
function parseVerdict(result) {
	// Compilation Error
	if (result.compilationError) {
		return 'CE'
	}

	// Time Limit Exceeded
	if (result.timedOut) {
		return 'TLE'
	}

	// Memory Limit Exceeded (Linux OOM killer sends SIGKILL → exit 137)
	if (result.oomKilled || result.exitCode === 137) {
		return 'MLE'
	}

	// Runtime Error (SIGSEGV=139, SIGABRT=134, SIGFPE=136, or any non-zero)
	if (result.exitCode !== 0) {
		return 'RE'
	}

	// Accepted — process exited cleanly
	return 'AC'
}

// ─────────────────────────────────────────────
// Task processor
// ─────────────────────────────────────────────

async function processTask(taskPayload) {
	let task
	try {
		task = JSON.parse(taskPayload)
	} catch (parseErr) {
		console.error('[worker] Failed to parse task payload:', parseErr.message)
		return
	}

	const {
		submissionId,
		code,
		language,
		input,
		socketId,
		roomId,
		userId,
	} = task

	if (!submissionId || !code || !language) {
		console.error('[worker] Invalid task — missing required fields:', { submissionId, language })
		return
	}

	const resolvedLang = resolveLanguage(language)
	if (!resolvedLang) {
		console.error(`[worker] Unsupported language: "${language}"`)
		await publishResult(submissionId, socketId, roomId, 'CE', '', `Unsupported language: ${language}`, 0)
		return
	}

	const executor = EXECUTORS[resolvedLang]
	if (!executor) {
		console.error(`[worker] No executor for language: "${resolvedLang}"`)
		await publishResult(submissionId, socketId, roomId, 'CE', '', `No executor available for: ${resolvedLang}`, 0)
		return
	}

	console.log(`[worker] ▶ Processing ${submissionId} | lang=${resolvedLang} | user=${userId || 'anon'}`)

	try {
		const result = await executor(code, input || '', submissionId, socketId, roomId)
		const verdict = parseVerdict(result)

		console.log(`[worker] ✓ ${submissionId} → ${verdict} (${result.executionTimeMs}ms)`)

		await publishResult(
			submissionId,
			socketId,
			roomId,
			verdict,
			result.stdout,
			result.stderr,
			result.executionTimeMs
		)
	} catch (execErr) {
		console.error(`[worker] ✗ ${submissionId} — Executor crashed:`, execErr.message)

		// Don't let the worker die — publish an error result instead
		await publishResult(
			submissionId,
			socketId,
			roomId,
			'RE',
			'',
			`Internal execution error: ${execErr.message}`,
			0
		)
	}
}

// ─────────────────────────────────────────────
// Docker image pre-pull
// ─────────────────────────────────────────────

async function ensureDockerImages() {
	const images = [...new Set(Object.values(CONFIG.docker.images))]

	for (const image of images) {
		try {
			// Check if image exists locally
			await docker.getImage(image).inspect()
			console.log(`[docker] ✓ Image ready: ${image}`)
		} catch (err) {
			if (err.statusCode === 404) {
				console.log(`[docker] ⬇ Pulling image: ${image} (this may take a moment)...`)
				try {
					const stream = await docker.pull(image)
					await new Promise((resolve, reject) => {
						docker.modem.followProgress(stream, (err) => {
							if (err) reject(err)
							else resolve()
						})
					})
					console.log(`[docker] ✓ Pulled: ${image}`)
				} catch (pullErr) {
					console.error(`[docker] ✗ Failed to pull ${image}:`, pullErr.message)
					throw pullErr
				}
			} else {
				throw err
			}
		}
	}
}

// ─────────────────────────────────────────────
// Main bootstrap
// ─────────────────────────────────────────────

async function main() {
	console.log('═══════════════════════════════════════════')
	console.log('  CodeVeritas Judge Worker — Starting Up')
	console.log('═══════════════════════════════════════════')
	console.log(`  PID:     ${process.pid}`)
	console.log(`  Host:    ${os.hostname()}`)
	console.log(`  Kafka:   ${CONFIG.kafka.brokers.join(', ')}`)
	console.log(`  Redis:   ${CONFIG.redis.host}:${CONFIG.redis.port}`)
	console.log(`  Group:   ${CONFIG.kafka.groupId}`)
	console.log(`  Tmp Dir: ${CONFIG.execution.tmpDir}`)
	console.log('═══════════════════════════════════════════')

	// Ensure temp directory exists
	ensureDir(CONFIG.execution.tmpDir)

	// Step 1: Connect Redis
	console.log('[boot] Connecting to Redis...')
	await redisPublisher.connect()
	console.log('[boot] ✓ Redis connected')

	// Step 2: Verify Docker daemon and pre-pull images
	console.log('[boot] Verifying Docker daemon...')
	try {
		const dockerInfo = await docker.info()
		console.log(`[boot] ✓ Docker daemon: ${dockerInfo.Name} (containers: ${dockerInfo.Containers})`)
	} catch (err) {
		console.error('[boot] ✗ Docker daemon unreachable. Is Docker running?')
		console.error('       Error:', err.message)
		process.exit(1)
	}

	console.log('[boot] Ensuring sandbox images are available...')
	await ensureDockerImages()

	// Step 3: Connect Kafka consumer
	console.log('[boot] Connecting Kafka consumer...')
	await consumer.connect()
	console.log('[boot] ✓ Kafka consumer connected')

	await consumer.subscribe({
		topic: CONFIG.kafka.taskTopic,
		fromBeginning: false,
	})
	console.log(`[boot] ✓ Subscribed to topic: ${CONFIG.kafka.taskTopic}`)

	// Step 4: Start consuming
	await consumer.run({
		// Process one message at a time for predictable resource usage
		partitionsConsumedConcurrently: 1,
		eachMessage: async ({ topic, partition, message }) => {
			const value = message.value?.toString()
			if (!value) return

			console.log(`[kafka] Received message from ${topic}[${partition}] offset=${message.offset}`)

			try {
				await processTask(value)
			} catch (err) {
				// Catch-all — worker must never crash from a bad task
				console.error('[kafka] Unhandled error in task processor:', err)
			}
		},
	})

	console.log('═══════════════════════════════════════════')
	console.log('  ✓ Judge Worker is LIVE — waiting for tasks')
	console.log('═══════════════════════════════════════════')
}

// ─────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────

async function shutdown(signal) {
	console.log(`\n[shutdown] Received ${signal} — shutting down gracefully...`)

	try {
		console.log('[shutdown] Disconnecting Kafka consumer...')
		await consumer.disconnect()
	} catch (err) {
		console.error('[shutdown] Kafka disconnect error:', err.message)
	}

	try {
		console.log('[shutdown] Disconnecting Redis...')
		await redisPublisher.quit()
	} catch (err) {
		console.error('[shutdown] Redis disconnect error:', err.message)
	}

	// Cleanup temp directory
	cleanupDir(CONFIG.execution.tmpDir)

	console.log('[shutdown] ✓ Clean shutdown complete')
	process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Prevent unhandled rejections from killing the worker
process.on('unhandledRejection', (reason) => {
	console.error('[worker] Unhandled rejection:', reason)
})

// ─────────────────────────────────────────────
// Launch
// ─────────────────────────────────────────────

main().catch((err) => {
	console.error('[boot] ✗ Fatal startup error:', err)
	process.exit(1)
})
