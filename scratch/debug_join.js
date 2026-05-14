import oracledb from 'oracledb';

const dbConfig = {
  user: "COCA",
  password: "MANAGER",
  connectString: "192.168.1.3:1521/ORCL" 
};

async function checkJoin() {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    console.log("Checking Join VW_COCA and CADASTROS...");
    const result = await connection.execute(
      `SELECT VW.CADASTRO_ID, C.SITUACAO 
       FROM VW_COCA VW, CADASTROS C 
       WHERE VW.CADASTRO_ID = C.CADASTRO_ID 
       AND ROWNUM <= 10`
    );
    console.log("Sample Rows (No status filter):", result.rows);

    const result2 = await connection.execute(
      `SELECT COUNT(*) 
       FROM VW_COCA VW, CADASTROS C 
       WHERE VW.CADASTRO_ID = C.CADASTRO_ID 
       AND C.SITUACAO = 'Normal'`
    );
    console.log("Count with SITUACAO='Normal':", result2.rows[0][0]);

    const result3 = await connection.execute(
      `SELECT DISTINCT SITUACAO FROM CADASTROS FETCH NEXT 10 ROWS ONLY`
    );
    console.log("Sample SITUACAO values in CADASTROS:", result3.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (connection) await connection.close();
  }
}

checkJoin();
