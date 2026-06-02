require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const pdfParse = require('pdf-parse');
const Groq = require('groq-sdk');
const sqlite3 = require('sqlite3').verbose();

const app = express();

// =========================
// BANCO DE DADOS (SQLITE)
// =========================
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Erro ao conectar ao SQLite:', err.message);
    else console.log('📦 Conectado ao banco de dados SQLite.');
});

db.run(`CREATE TABLE IF NOT EXISTS historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pergunta TEXT,
    resposta TEXT,
    curso TEXT,
    disciplina TEXT,
    data DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// =========================
// MULTER
// =========================
const upload = multer({
    storage: multer.memoryStorage()
});

// =========================
// GROQ
// =========================
// =========================
// GROQ
// =========================
const groq = new Groq({
    apiKey: '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'
});

// =========================
// MIDDLEWARES
// =========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// =========================
// ROTAS DE PÁGINAS
// =========================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/api/historico', (req, res) => {
    db.all("SELECT * FROM historico ORDER BY data DESC LIMIT 20", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.delete('/api/historico', (req, res) => {
    db.run("DELETE FROM historico", [], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Histórico limpo com sucesso!" });
    });
});

// =========================
// ROTA PRINCIPAL: IA + PDF (CORRIGIDA)
// =========================
app.post('/ask', upload.array('files'), async (req, res) => {
    try {
        console.log("=== REQUISIÇÃO RECEBIDA ===");
        const { question, curso, disciplina } = req.body;

        let contextText = "";

        // CORREÇÃO: Lendo e acumulando o texto dos PDFs corretamente
        if (req.files && req.files.length > 0) {
            console.log(`Recebidos ${req.files.length} arquivo(s)`);
            
            for (const file of req.files) {
                console.log("Processando arquivo:", file.originalname);
                
                if (file.mimetype === 'application/pdf') {
                    try {
                        const data = await pdfParse(file.buffer);
                        // Acumula o texto extraído do PDF
                        contextText += `\nConteúdo extraído do arquivo "${file.originalname}":\n${data.text}\n`;
                    } catch (pdfError) {
                        console.log("Erro ao extrair texto do PDF:", pdfError);
                    }
                }
            }
        }

        // CONSTRUÇÃO DO PROMPT DA IA
        let systemInstructions = "Você é o IFAL Mentor AI, um assistente acadêmico prestativo e inteligente.\n";
        
        if (curso && curso.trim() !== "") systemInstructions += `Curso do aluno: ${curso}\n`;
        if (disciplina && disciplina.trim() !== "") systemInstructions += `Disciplina: ${disciplina}\n`;

        // Se houver texto do PDF, ele é injetado diretamente como contexto ANTES da pergunta
        let finalUserMessage = "";
        if (contextText.trim() !== "") {
            console.log("Texto do PDF injetado com sucesso no prompt.");
            finalUserMessage = `Use as seguintes informações extraídas dos arquivos enviados para responder à pergunta do aluno.\n\n[INFORMAÇÕES DOS ARQUIVOS]:\n${contextText}\n\n[PERGUNTA DO ALUNO]:\n${question}`;
        } else {
            console.log("Nenhum texto de PDF foi extraído.");
            finalUserMessage = question;
        }

        // Chamada da IA do Groq
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemInstructions },
                { role: "user", content: finalUserMessage }
            ]
        });

        const botAnswer = completion.choices[0].message.content;

        // Salva a conversa no SQLite
        const stmt = db.prepare("INSERT INTO historico (pergunta, resposta, curso, disciplina) VALUES (?, ?, ?, ?)");
        stmt.run(question, botAnswer, curso || "", disciplina || "");
        stmt.finalize();

        console.log("Mensagem salva no banco de dados!");

        res.json({ answer: botAnswer });

    } catch (error) {
        console.log("ERRO GERAL NO SERVIDOR:", error);
        res.status(500).json({ error: "Erro interno ao processar a IA." });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Sistema ON: http://localhost:${PORT}`);
});