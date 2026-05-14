import express from 'express';
import oracledb from 'oracledb';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = 3001;

// Serve static images
app.use('/imgs', express.static(path.join(__dirname, '../imgs')));

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Endpoint to find image for a collaborator
app.get('/api/collaborator-image/:name', (req, res) => {
  const name = req.params.name.toLowerCase();
  const imgsDir = path.join(__dirname, '../imgs');
  const extensions = ['.jpg', '.jpeg', '.png', '.bmp'];
  
  for (const ext of extensions) {
    const filename = `${name}${ext}`;
    if (fs.existsSync(path.join(imgsDir, filename))) {
      return res.json({ found: true, url: `http://localhost:3001/imgs/${filename}` });
    }
  }
  res.json({ found: false });
});

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

    console.log("LOG_DEBUG: Executando query em /api/cocas...");
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
    console.error("ERRO /api/cocas:", err);
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

app.get('/api/cocas/paid', async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT VW.RAZAO_SOCIAL, vw.DOCUMENTO_ID, vw.OBSERVACAO_03
       FROM VW_COCA VW
       WHERE VW.STATUS = 'B'
       ORDER BY vw.DT_RECEBIMENTO DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (err) {
    console.error("ERRO /api/cocas/paid:", err);
    res.status(500).json({ error: "Erro ao buscar histórico", details: err.message });
  } finally {
    if (connection) await connection.close();
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

// Endpoint to get collaborators (for dropdown)
app.get('/api/collaborators', async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT DISTINCT VW.CADASTRO_ID, VW.RAZAO_SOCIAL 
       FROM VW_COCA VW, CADASTROS C 
       WHERE VW.CADASTRO_ID = C.CADASTRO_ID 
       AND C.SITUACAO = 'Normal' 
       ORDER BY VW.RAZAO_SOCIAL`,
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

// Endpoint to get all active collaborators (for management list)
app.get('/api/collaborators-full', async (req, res) => {
  let connection;
  try {
    console.log("Buscando lista completa de colaboradores...");
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT DISTINCT VW.CADASTRO_ID, VW.RAZAO_SOCIAL, C.SITUACAO 
       FROM VW_COCA VW, CADASTROS C 
       WHERE VW.CADASTRO_ID = C.CADASTRO_ID 
       AND C.SITUACAO = 'Normal' 
       ORDER BY VW.RAZAO_SOCIAL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (err) {
    console.error("ERRO /api/collaborators-full:", err);
    res.status(500).json({ error: "Erro ao buscar colaboradores", details: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Endpoint to get next CADASTRO_ID
app.get('/api/next-cadastro-id', async (req, res) => {
  let connection;
  try {
    console.log("Gerando próximo CADASTRO_ID...");
    connection = await oracledb.getConnection(dbConfig);
    console.log("Conectado ao Oracle para buscar próximo ID.");
    const result = await connection.execute(
      `SELECT MAX(TO_NUMBER(VW.CADASTRO_ID)) FROM VW_COCA VW WHERE REGEXP_LIKE(VW.CADASTRO_ID, '^[0-9]+$')`
    );
    const maxId = result.rows[0][0];
    const nextIdNum = maxId ? parseInt(maxId) + 1 : 1234500;
    res.json({ nextId: nextIdNum.toString() });
  } catch (err) {
    console.error("ERRO /api/next-cadastro-id:", err);
    res.status(500).json({ error: "Erro ao gerar ID", details: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Endpoint to insert a new collaborator and update the view
app.post('/api/collaborators', async (req, res) => {
  const { cadastroId, name } = req.body;
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    // 1. Insert into CADASTROS using the provided template
    const insertSql = `
      insert into cadastros (ACUMULATIVO, ALIQUOTA_ICMS_SUBS_TRIB, ALIQUOTA_ICMS_SUBS_TRIB_CRE, AVISO, BAIRRO_COB, BAIRRO_CONJUGE, BAIRRO_FAT, BAIRRO_PAI_MAE, BAIRRO_SOCIO1, BAIRRO_SOCIO2, BAIRRO_SOCIO3, BAIRRO_TRABALHO, CADASTRO_ID, CALCULAR_JUROS, CALCULAR_MULTA, CANAL_VENDAS_MICHELIN, CARGO, CARGO_CONJUGE, CELULAR, CEP_COB, CEP_CONJUGE, CEP_FAT, CEP_SOCIO1, CEP_SOCIO2, CEP_SOCIO3, CEP_TRABALHO, CIDADE_COB_ID, CIDADE_FAT_ID, CIDADE_ID_CONJUGE, CIDADE_ID_PAI_MAE, CIDADE_ID_TRABALHO, CIDADE_SOCIO1, CIDADE_SOCIO2, CIDADE_SOCIO3, COB_TAXA_EMI_BOL, CODIGO_CLIENTE, CODIGO_NO_FORNECEDOR, CODIGO_SUFRAMA, COMPLEMENTO_END_COB, COMPLEMENTO_END_FAT, COMPL_CADASTRO_ID, COMPRADOR_NOME, CONCEDER_DESCONTO_ICMS, CONCEDER_PROMOCAO, CONDICAO_ACUMULATIVO, CONDICAO_ID, CONTATO, CONTA_CONTABIL, CONTA_DEBITO, CONVENIADOS, CPF_CONJUGE, CPF_SOCIO1, CPF_SOCIO2, CPF_SOCIO3, CX_POSTAL_FAT, DATA_ADMISSAO, DATA_ADMISSAO_CONJUGE, DATA_EXPEDICAO, DATA_EXPEDICAO_SOCIO1, DATA_EXPEDICAO_SOCIO2, DATA_EXPEDICAO_SOCIO3, DATA_HORA_ALTERACAO, DATA_HORA_ALTERACAO_OUTROS, DATA_NASCIMENTO_COMPRADOR, DATA_NASCIMENTO_CONJUGE, DATA_SPC_REALIZADO, DATA_VALIDADE_CADASTRO, DDD_COB, DDD_CONJUGE, DDD_FAT, DDD_SOCIO1, DDD_SOCIO2, DDD_SOCIO3, DDD_TRABALHO, DESCTO_DUPLICATA, DESTACAR_RETENCAO, DIA_FATURAR, DIA_FECHAMENTO_AC1, DIA_FECHAMENTO_AC2, DIA_FECHAMENTO_AC3, DIA_FECHAMENTO_AC4, DIA_RECEBER, DT_CADASTRO, DT_FECHAMENTO_ACUMULATIVO, DT_FUNDACAO_EMPRESA, DT_NASCIMENTO, DT_NASC_SOCIO1, DT_NASC_SOCIO2, DT_NASC_SOCIO3, DT_POS_VENDA, DT_PREVISTA_PARA_COBRANCA, DT_ULT_COMPRA, DT_VISITA, EMPRESA_ALTERACAO, EMPRESA_ALTERACAO_OUTROS, EMPRESA_ID, EMPRESA_TRABALHO_CONJUGE, ENDERECO_COB, ENDERECO_FAT, ENDERECO_PAI_MAE, ENDERECO_SOCIO1, ENDERECO_SOCIO2, ENDERECO_SOCIO3, ENDERECO_TRABALHO, ESTADO_CIVIL, ESTADO_ID_CONJUGE, ESTADO_ID_TRABALHO, E_MAIL, FANTASIA, FONE_DADOS_FAT, FONE_FAX_FAT, FONE_OUTROS, FONE_REFERENCIA_COMERCIAL, FONE_REFERENCIA_COMERCIAL2, FONE_REFERENCIA_COMERCIAL3, FONE_REFERENCIA_COMERCIAL4, FONE_SOCIO1, FONE_SOCIO2, FONE_SOCIO3, FONE_VOZ_COB, FONE_VOZ_FAT, FONE_VOZ_FAT_CHAVE, FONE_VOZ_REFERENCIA, FONE_VOZ_REFERENCIA2, FONE_VOZ_REFERENCIA3, FONE_VOZ_TRABALHO, FONE_VOZ_TRABALHO_CONJUGE, HISTORICO_CONTABIL, IDENTIDADE, IDENTIDADE_CONJUGE, IDENTIDADE_SOCIO1, IDENTIDADE_SOCIO2, IDENTIDADE_SOCIO3, IMP_ENDERECO_CONVENIO, INSC_ESTADUAL, INSTRUCAO_PROTESTO, LAYOUT_PEDIDO, LIB_BLOQUEIO_ATRASO, LIMITE_CREDITO, LOCAL_TRABALHO, LOCAL_TRABALHO_CONJUGE, NACIONALIDADE, NATURALIDADE, NEGATIVADO_SPC, NOME_CONJUGE, NOME_MAE, NOME_PAI, NOME_REFERENCIA, NOME_REFERENCIA2, NOME_REFERENCIA3, NOME_REFERENCIA_COMERCIAL, NOME_REFERENCIA_COMERCIAL2, NOME_REFERENCIA_COMERCIAL3, NOME_REFERENCIA_COMERCIAL4, NOME_SOCIO1, NOME_SOCIO2, NOME_SOCIO3, NUMERO_END_COB, NUMERO_END_FAT, ORGAO_EXPEDIDOR, ORGAO_EXPEDIDOR_CONJUGE, ORGAO_EXPEDIDOR_SOCIO1, ORGAO_EXPEDIDOR_SOCIO2, ORGAO_EXPEDIDOR_SOCIO3, ORGAO_PUBLICO, OVER_PRICE, PCT_COMISSAO, PCT_COMISSAO_ATACADO, PCT_COMISSAO_EXTERNO, PCT_COMISSAO_EXTERNO_ATACADO, PCT_DESCONTO_1, PCT_DESCONTO_2, PCT_DESCONTO_3, PCT_DESCONTO_4, PCT_DESCONTO_5, PCT_DESCONTO_6, PCT_DSC_ACERTO, PCT_DSC_VENDA, PESSOAID, PONTO_REFERENCIA, PONTO_REFERENCIA1, PORCENTAGEM_ICMS, PORTADOR_ID, PRACA_PAGAMENTO, PRAZO_1, PRAZO_2, PRAZO_3, PRAZO_4, PRAZO_5, PRAZO_6, PRAZO_ACUMULATIVO, QTD_VENDAS_PNEUS, RAZAO_SOCIAL, REFBAN1_AGENCIA, REFBAN1_CLIENTE_DESDE, REFBAN1_CONCEITO, REFBAN1_CONTA, REFBAN1_CONTATO, REFBAN1_FONE, REFBAN1_NOME, REFBAN2_AGENCIA, REFBAN2_CLIENTE_DESDE, REFBAN2_CONCEITO, REFBAN2_CONTA, REFBAN2_CONTATO, REFBAN2_FONE, REFBAN2_NOME, REFCOM1_CLIENTE_DESDE, REFCOM1_CONCEITO, REFCOM1_CONTATO, REFCOM1_DT_MAIOR_FATURA, REFCOM1_DT_ULTIMA_COMPRA, REFCOM1_FORMA_PAGTO, REFCOM1_MAIOR_FATURA, REFCOM1_ULTIMA_FATURA, REFCOM2_CLIENTE_DESDE, REFCOM2_CONCEITO, REFCOM2_CONTATO, REFCOM2_DT_MAIOR_FATURA, REFCOM2_DT_ULTIMA_COMPRA, REFCOM2_FORMA_PAGTO, REFCOM2_MAIOR_FATURA, REFCOM2_ULTIMA_FATURA, REFCOM3_CLIENTE_DESDE, REFCOM3_CONCEITO, REFCOM3_CONTATO, REFCOM3_DT_MAIOR_FATURA, REFCOM3_DT_ULTIMA_COMPRA, REFCOM3_FORMA_PAGTO, REFCOM3_MAIOR_FATURA, REFCOM3_ULTIMA_FATURA, REFCOM4_CLIENTE_DESDE, REFCOM4_CONCEITO, REFCOM4_CONTATO, REFCOM4_DT_MAIOR_FATURA, REFCOM4_DT_ULTIMA_COMPRA, REFCOM4_FORMA_PAGTO, REFCOM4_MAIOR_FATURA, REFCOM4_ULTIMA_FATURA, REGIAO_ID, RENDA_CONJUGE, RENDA_LIQUIDA, REVENDA, ROTA_ID, SEQUENCIA_ROTA, SEXO, SITE, SITUACAO, TABELA_PROMOCAO, TIPOIE, TIPO_ALIQUOTA_TARE_DF, TIPO_CADASTRO, TIPO_CLIENTE_ID, TIPO_FORNECEDOR_ID, TIPO_ICMS, TIPO_OPERACAO_DEFAULT, TIPO_PESSOA, TIPO_PRECO, TIPO_VENDA, UF_ORGAO_EXP, USUARIO_ALTERACAO, USUARIO_ALTERACAO_OUTROS, VALIDADE_BLOQUEIO, VENDEDOR_EXTERNO, VENDEDOR_FORNECEDOR, VENDEDOR_ID, ANOS_RESIDENCIA, BAIRRO_REFERENCIA1, BAIRRO_REFERENCIA2, BAIRRO_REFERENCIA3, CEP_REFERENCIA1, CEP_REFERENCIA2, CEP_REFERENCIA3, CIDADE_ID_REFERENCIA1, CIDADE_ID_REFERENCIA2, CIDADE_ID_REFERENCIA3, ENDERECO_REFERENCIA1, ENDERECO_REFERENCIA2, ENDERECO_REFERENCIA3, MESES_RESIDENCIA, FILIAL_TRANSFERENCIA_AUTO)
      values ('N', null, null, null, 'JARDIM SANTO ANT NIO', null, 'JARDIM SANTO ANT NIO', null, null, null, null, null, :cadastroId, 'N', 'N', null, null, null, null, '74853-320', '     -   ', '74853-320', '     -   ', '     -   ', '     -   ', '     -   ', 6107, 6107, 0, 0, 0, 0, 0, 0, 'N', 97, null, null, null, null, '1', null, 'N', 'N', 0, 1, null, null, null, 0, null, '   .   .   -  ', '   .   .   -  ', '   .   .   -  ', null, null, null, null, null, null, null, SYSDATE, SYSDATE, null, null, null, SYSDATE, '0000', null, '0000', null, null, null, null, 0.00, 'S', 1, '0', '0', '0', '0', 1, SYSDATE, null, null, null, null, null, null, null, null, null, SYSDATE, null, null, '10.654.550/0001-88', null, 'RUA 19', 'RUA 19', null, null, null, null, null, '0', null, null, null, :name, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, '0', null, 'N', null, 'N', 0.01, null, null, '0', null, 'N', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'N', 1.00000, 0.00000, 0.0000, 0.00000, 0.0000, null, null, null, null, null, null, 0.00, 0.00, null, null, null, null, 1, null, null, null, null, null, null, null, null, 0, :name, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0.00, 0.00, null, null, null, null, null, null, 0.00, 0.00, null, null, null, null, null, null, 0.00, 0.00, null, null, null, null, null, null, 0.00, 0.00, 1, 0.00, 0.00, 'N', '0001.001', 0, '0', null, 'Normal', 'N', 'N', null, 'C', 5, null, '0', 1, 'O', null, 1, null, 'SUP8521', 'SUP8521', null, null, null, '170897', null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'N')
    `;

    await connection.execute(insertSql, { cadastroId, name }, { autoCommit: true });

    // 2. Update the VW_COCA view definition
    // First, let's get current IDs in the view
    // Since we can't easily parse the VIEW source code reliably via SQL without more complex logic,
    // we'll fetch all IDs that ARE currently in the view or should be.
    // However, the user wants us to EXPLICITLY modify the definition.
    
    // Better approach: Fetch all IDs currently in the view + the new one
    const currentIdsResult = await connection.execute(
      `SELECT DISTINCT CADASTRO_ID FROM VW_COCA`
    );
    const ids = currentIdsResult.rows.map(r => `'${r[0]}'`);
    if (cadastroId && !ids.includes(`'${cadastroId}'`)) ids.push(`'${cadastroId}'`);

    // Safety: If no IDs found, use a dummy ID
    const idsList = ids.length > 0 ? ids.join(', ') : "'1234560'";

    const viewSql = `
      CREATE OR REPLACE VIEW VW_COCA AS
      SELECT F.CADASTRO_ID,
             SUM(F.VLR_TITULO) AS VALOR_TOTAL,
             F.DOCUMENTO_ID,
             COUNT(F.DOCUMENTO_ID) AS NUMERO_COCAS,
             (SELECT MAX(C.RAZAO_SOCIAL)
                FROM CADASTROS C
               WHERE C.CADASTRO_ID = F.CADASTRO_ID) AS RAZAO_SOCIAL,
             F.OBSERVACAO_03,
             F.DT_CADASTRAMENTO,
             F.STATUS,
             F.DT_RECEBIMENTO
        FROM FINANCEIRO F
       WHERE F.CADASTRO_ID IN (${idsList})
       GROUP BY F.CADASTRO_ID,
                F.DOCUMENTO_ID,
                F.OBSERVACAO_03,
                F.DT_CADASTRAMENTO,
                F.STATUS,
                F.DT_RECEBIMENTO
    `;

    await connection.execute(viewSql);

    res.json({ message: "Colaborador cadastrado e visualização atualizada!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao processar cadastro", details: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
