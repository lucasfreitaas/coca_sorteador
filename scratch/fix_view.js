import oracledb from 'oracledb';

const dbConfig = {
  user: "COCA",
  password: "MANAGER",
  connectString: "192.168.1.3:1521/ORCL" 
};

async function fixView() {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    console.log("Conectado ao Oracle para fix da View...");

    // Get current IDs
    const currentIdsResult = await connection.execute(
      `SELECT DISTINCT CADASTRO_ID FROM FINANCEIRO WHERE STATUS = 'A'`
    );
    const ids = currentIdsResult.rows.map(r => `'${r[0]}'`);
    const idsList = ids.length > 0 ? ids.join(', ') : "'000000'";

    const viewSql = `
      CREATE OR REPLACE VIEW VW_COCA AS
      SELECT F.CADASTRO_ID,
             SUM(F.VLR_TITULO) AS VALOR_TOTAL,
             F.DOCUMENTO_ID,
             COUNT(F.DOCUMENTO_ID) AS NUMERO_COCAS,
             MAX(C.RAZAO_SOCIAL) AS RAZAO_SOCIAL,
             F.OBSERVACAO_03,
             F.DT_CADASTRAMENTO,
             F.STATUS,
             F.DT_RECEBIMENTO
        FROM FINANCEIRO F
        LEFT JOIN CADASTROS C ON C.CADASTRO_ID = F.CADASTRO_ID
       WHERE F.CADASTRO_ID IN (${idsList})
       GROUP BY F.CADASTRO_ID,
                F.DOCUMENTO_ID,
                F.OBSERVACAO_03,
                F.DT_CADASTRAMENTO,
                F.STATUS,
                F.DT_RECEBIMENTO
    `;

    await connection.execute(viewSql);
    console.log("View VW_COCA atualizada com sucesso usando JOIN!");
  } catch (err) {
    console.error("Erro ao fixar view:", err);
  } finally {
    if (connection) await connection.close();
  }
}

fixView();
