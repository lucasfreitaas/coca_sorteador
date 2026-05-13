import express from 'express';
import oracledb from 'oracledb';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Oracle Connection Config
const dbConfig = {
  user: "COCA",
  password: "MANAGER",
  connectString: "192.168.1.3:1521/ORCL" 
};

// Enable Thin mode (no Oracle Client required)
oracledb.initOracleClient({ libDir: "" }); // Passing empty or omitting enables Thin mode in newer versions, 
// but actually in 6.0+ Thin mode is default. Let's just try to connect.

app.get('/api/cocas', async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);

    // The query provided by the user
    const result = await connection.execute(
      `SELECT VW.RAZAO_SOCIAL, vw.DOCUMENTO_ID, vw.OBSERVACAO_03
       FROM VW_COCA VW
       WHERE VW.STATUS = 'A'
       ORDER BY vw.DOCUMENTO_ID DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao conectar ao Oracle", details: err.message });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
});

// Endpoint to pay (dar baixa) a coca
app.put('/api/cocas/pay/:id', async (req, res) => {
  const { id } = req.params;
  let connection;
  console.log(`Tentando dar baixa na coca: ${id}`);
  
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    // Update the record in FINANCEIRO table
    // Using TRIM and status check to be more precise
    const result = await connection.execute(
      `UPDATE FINANCEIRO 
       SET STATUS = 'B', 
           DT_RECEBIMENTO = SYSDATE, 
           DATA_HORA_ALTERACAO = SYSDATE 
       WHERE TRIM(DOCUMENTO_ID) = TRIM(:id)
         AND STATUS = 'A'`,
      [id],
      { autoCommit: true }
    );

    console.log(`Linhas afetadas: ${result.rowsAffected}`);

    if (result.rowsAffected && result.rowsAffected > 0) {
      res.json({ message: "Coca paga com sucesso!" });
    } else {
      res.status(404).json({ error: "Coca não encontrada ou já baixada." });
    }
  } catch (err) {
    console.error("Erro no Oracle:", err);
    res.status(500).json({ error: "Erro ao processar baixa", details: err.message });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
});

// Endpoint to get next COCA ID
app.get('/api/next-id', async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT DOCUMENTO_ID FROM VW_COCA WHERE DOCUMENTO_ID LIKE 'COCA%'`
    );
    
    let maxId = 0;
    result.rows.forEach(row => {
      const idStr = row[0] || "";
      const num = parseInt(idStr.replace('COCA', ''));
      if (!isNaN(num) && num > maxId) maxId = num;
    });

    res.json({ nextId: `COCA${maxId + 1}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Endpoint to get collaborators
app.get('/api/collaborators', async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `select f.razao_social, vw.CADASTRO_ID
       from cadastros f, vw_coca vw
       where f.cadastro_id = vw.CADASTRO_ID
       and f.situacao = 'Normal'
       group by f.razao_social, vw.cadastro_id
       order by f.razao_social`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Endpoint to insert a new coca
app.post('/api/cocas', async (req, res) => {
  const { docId, cadastroId, reason } = req.body;
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    // Using current date for emission and cadastramento as per example logic
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getFullYear()}`;
    const competencia = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    const sql = `
      Insert Into FINANCEIRO
      (EMPRESA_ID, TIPO_CONTA, TIPO_DOC, DOCUMENTO_ID, PEDIDO_ID, VLR_TITULO, VLR_COMISSAO, 
       DT_EMISSAO, DT_VENCTO, NOSSO_NUMERO, DT_VENCTO_ANT, OBSERVACAO, CADASTRO_ID, 
       COMPL_CADASTRO_ID, PORTADOR_ID, TIPO_PAG_REC_ID, PCT_DESCONTO_ORG_PUB, 
       C_CONTA_CREDITO, C_CONTA_DEBITO, C_CENTRO_ID, C_CODIGO_HISTORICO, 
       C_HISTORICO_COMPLEMENTAR, PROVISIONADO, STATUS, DT_CADASTRAMENTO, 
       OBSERVACAO_02, OBSERVACAO_03, AUTUACAO, PROCESSO, DETENTOR, PREVISAO, 
       SACADOR_AVALISTA_ID, VLR_COMISSAO_EXTERNO, VLR_ACRESCIMO_FINANCEIRO, 
       CODIGO_PLANO, CODIGO_CENTRO, VLR_COMISSAO_SUPERVISOR, lancamento_manual, competencia)
      Values 
      ('10.654.550/0001-88', 'CR', 'DP', :docId, '', 12.0, 0.0, 
       SYSDATE, SYSDATE, '', SYSDATE, '', :cadastroId, 
       '1', '17', '12', 0.0, 
       '', '', 0, '', '', 'N', 'A', SYSDATE, 
       '', :reason, '', '', '', SYSDATE, 
       0.0, 0.0, 0.0, '01.001.001', '0001', 0.0, 'S', :competencia)
    `;

    await connection.execute(sql, {
      docId: docId,
      cadastroId: cadastroId,
      reason: reason,
      competencia: competencia
    }, { autoCommit: true });

    res.json({ message: "Coca registrada com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao inserir coca", details: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
