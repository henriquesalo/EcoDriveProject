const express = require('express');
const path = require('path');
const app = express();
const router = express.Router();
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
// const users = {};

// Conexão com o banco de dados
const db = new sqlite3.Database('meubanco.sqlite', (err) => {
  if (err) {
    console.error('Erro ao conectar ao SQLite:', err);
    return;
  }
  console.log('Conectado ao SQLite com sucesso!');
});

// Criando tabela de usuários
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  resetPasswordToken TEXT,
  resetPasswordExpires INTEGER
)`, (err) => {
  if (err) {
    console.error('Erro ao criar tabela:', err);
  }
});

// Criando tabela de carros
db.run(`CREATE TABLE IF NOT EXISTS cars(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ano INTEGER NOT NULL,
    chassi TEXT NOT NULL,
    marca TEXT NOT NULL,
    imagem TEXT NOT NULL,
    modelo TEXT NOT NULL,
    preco REAL NOT NULL
)`, (err) => {
    if(err) {
        console.error('Erro ao criar tabela de carros:', err);
    }
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());

// Rota raiz 
router.get('/', function (req, res) {
    res.redirect('/login');
});

// Rota para a página de login
router.get('/login', function (req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
});

// Rota para a página de registro
router.get('/pages/registro.html', function (req, res) {
    res.sendFile(path.join(__dirname, '/pages/registro.html'));
});

// Rota para a página de troca de senha
router.get('/pages/request-password-reset.html', function (req, res) {
    res.sendFile(path.join(__dirname, '/pages/request-password-reset.html'));
});

// Rota para solicitar a troca de senha
app.post('/request-password-reset', (req, res) => {
    const { username } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (!user) {
            return res.status(400).send('Usuário não encontrado');
        }

        const token = crypto.randomBytes(20).toString('hex');
        const expires = Date.now() + 3600000;

        db.run('UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE username = ?', [token, expires, username], (err) => {
            if (err) {
                return res.status(500).send('Erro ao salvar o token');
            }

            console.log(`Token gerado para o usuário ${username}: ${token}`);

            // Enviar link para troca de senha
            res.send(`Use este link para redefinir sua senha: <a href="http://${req.headers.host}/reset-password/${token}">Redefinir Senha</a>`);
        });
    });
});

// Rota para exibir o form de troca de senha
app.get('/reset-password/:token', (req, res) => {
    const { token } = req.params;
    db.get('SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?', [token, Date.now()], (err, user) => {
        if (!user) {
            return res.status(400).send('Token de redefinição de senha é inválido ou expirou.');
        }
      
        res.send(`
            <form action="/reset-password" method="post">
            <input type="hidden" name="token" value="${token}" />
            <label for="password">Nova Senha:</label>
            <input type="password" id="password" name="password" required />
            <label for="confirmPassword">Confirme a Nova Senha:</label>
            <input type="password" id="confirmPassword" name="confirmPassword" required />
            <button type="submit">Redefinir Senha</button>
            </form>
        `);
    });
});

// Rota para executar a redefinição de senha
app.post('/reset-password', async (req, res) => {
    const { token, password, confirmPassword } = req.body;
  
    if (password !== confirmPassword) {
        return res.status(400).send('As senhas não coincidem.');
    }
  
    db.get('SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?', [token, Date.now()], async (err, user) => {
        if (!user) {
            return res.status(400).send('Token de redefinição de senha é inválido ou expirou.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.run('UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?', [hashedPassword, user.id], (err) => {
            if (err) {
                return res.status(500).send('Erro ao salvar a nova senha');
            }

            res.redirect('/login');
        });
    });
});

// Rota de registro
router.post('/register', async function (req, res) {
    const { username, password, confirmPassword, email, telefone } = req.body;

    console.log('Recebido username:', username);
    
    if (!username || !password || !confirmPassword || !email || !telefone) {
        return res.status(400).send('Todos os campos são obrigatórios');
    }

    if (password !== confirmPassword) {
        return res.status(400).send('As senhas não coincidem');
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run('INSERT INTO users (username, password, email, telefone) VALUES (?, ?, ?, ?)', [username, hashedPassword, email, telefone], function (err) {
            if (err) {
                console.error('Erro ao registrar usuário:', err);
                return res.status(500).send('Erro interno do servidor');
            }

            res.redirect('/login');
        });

    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).send('Erro interno do servidor');
    }
});

// Rota de login
router.post('/login', async function (req, res) {
    const { username, password } = req.body;

    console.log('Tentativa de login username:', username);
    //console.log('Tentativa de login password:', password);

    if (!username || !password) {
        return res.status(400).send('Username e password são obrigatórios');
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (!user) {
            return res.status(400).send('Usuário não encontrado');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(400).send('Senha incorreta');
        }

        res.redirect('/home');
    });
});

// Rota para  a página de venda de carros
app.get('/sellcar', function(req, res) {
    res.sendFile(path.join(__dirname, '/pages/sellCars.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/styles', express.static(path.join(__dirname, 'public/styles')));

app.use('/scripts', express.static(path.join(__dirname, 'public/scripts')));

app.use('/', router);

// Rota para a home page
router.get('/home', function (req, res) {
    res.sendFile(path.join(__dirname, '/pages/home.html'));
});

// Rota de logout
router.get('/logout', function (req, res) {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).send('Erro ao fazer logout');
            }
            res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
});

// Rota para adicionar um novo carro
app.post('/api/cars', (req, res) => {
    const { ano, chassi, marca, imagem, modelo, preco } = req.body;
    
    const query = `INSERT INTO cars (ano, chassi, marca, imagem, modelo, preco) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [ano, chassi, marca, imagem, modelo, preco], function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao adicionar carro' });
      }
      res.status(200).json({ mensagem: 'Carro adicionado com sucesso!', id: this.lastID });
    });
});
  
// Rota para recuperar todos os carros
app.get('/api/cars', (req, res) => {
    const query = `SELECT * FROM cars`;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao recuperar carros' });
      }
      res.status(200).json(rows);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
    console.log(`Servidor rodando na porta ${PORT}`);
});