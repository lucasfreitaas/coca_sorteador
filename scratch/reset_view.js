import oracledb from 'oracledb';

const dbConfig = {
  user: "COCA",
  password: "MANAGER",
  connectString: "192.168.1.3:1521/ORCL" 
};

const initialIds = [
  '123451', '123452', '123453', '123454', '123455', '123457', '123458', '123459', 
  '1234510', '1234511', '1234512', '1234513', '1234514', '1234515', '1234516', 
  '1234517', '1234518', '1234519', '1234520', '1234521', '1234560'
];

async function resetView() {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    console.log("Conectado ao Oracle para reset da View...");

    const idsList = initialIds.map(id => `'${id}'`).join(', ');

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
    console.log("View VW_COCA resetada com sucesso para a estrutura e IDs originais!");
  } catch (err) {
    console.error("Erro ao resetar view:", err);
  } finally {
    if (connection) await connection.close();
  }
}

resetView();
