import oracledb from 'oracledb';

const dbConfig = {
  user: "COCA",
  password: "MANAGER",
  connectString: "192.168.1.3:1521/ORCL" 
};

async function checkView() {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT TEXT FROM USER_VIEWS WHERE VIEW_NAME = 'VW_COCA'`
    );
    if (result.rows.length > 0) {
      console.log("View Definition:");
      console.log(result.rows[0][0]);
    } else {
      console.log("View VW_COCA not found!");
    }
  } catch (err) {
    console.error("Erro ao checar view:", err);
  } finally {
    if (connection) await connection.close();
  }
}

checkView();
