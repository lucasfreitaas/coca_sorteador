import oracledb from 'oracledb';

const dbConfig = {
  user: "COCA",
  password: "MANAGER",
  connectString: "192.168.1.3:1521/ORCL" 
};

async function debugQuery() {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    console.log("Tentando executar a query problematica...");
    
    // Test 1: Simple select from FINANCEIRO
    console.log("Teste 1: FINANCEIRO");
    await connection.execute(`SELECT COUNT(*) FROM FINANCEIRO WHERE STATUS = 'A'`);
    console.log("Teste 1 OK");

    // Test 2: Simple select from CADASTROS
    console.log("Teste 2: CADASTROS");
    await connection.execute(`SELECT COUNT(*) FROM CADASTROS`);
    console.log("Teste 2 OK");

    // Test 3: The problematic query
    console.log("Teste 3: VW_COCA");
    const result = await connection.execute(
      `SELECT RAZAO_SOCIAL, DOCUMENTO_ID FROM VW_COCA WHERE STATUS = 'A' FETCH NEXT 5 ROWS ONLY`
    );
    console.log("Teste 3 result:", result.rows);

  } catch (err) {
    console.error("ERRO IDENTIFICADO:", err);
  } finally {
    if (connection) await connection.close();
  }
}

debugQuery();
