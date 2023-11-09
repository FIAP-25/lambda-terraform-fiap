const AWS = require("aws-sdk");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

const s3 = new AWS.S3();
const s3BucketName = "fiap-arquivos";
const envFileName = ".env";

function gerarTokenJWT(cpf, jwtSecret) {
  const secret = Buffer.from(jwtSecret, "base64");

  const token = jwt.sign({ cpf }, secret, {
    expiresIn: 3600,
  });

  return token;
}

export const lambdaHandler = async (event) => {
  console.log("log teste 2");
  const cpf = event.cpf;

  if (!cpf) {
    return {
      statusCode: 400,
      body: JSON.stringify({ mensagem: "Campo [cpf:string] não informado." }),
    };
  }

  try {
    //Obtém o arquivo .env do S3
    const s3Object = await s3
      .getObject({ Bucket: s3BucketName, Key: envFileName })
      .promise();
    var envConfig = "";

    if (s3Object && s3Object.Body) {
      envConfig = s3Object.Body.toString();
    }
    const parsedEnv = dotenv.parse(envConfig);

    const connection = await mysql.createConnection({
      host: parsedEnv.DATABASE_HOST,
      user: parsedEnv.DATABASE_USERNAME,
      password: parsedEnv.DATABASE_PASSWORD,
      database: parsedEnv.DATABASE_SCHEMA,
      port: Number(parsedEnv.DATABASE_PORT),
    });

    const [rows] = await connection.execute(
      "SELECT * FROM cliente WHERE cpf = ?",
      [cpf]
    );

    connection.end();
    if (Array.isArray(rows) && rows.length === 1) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          mensagem: "Autenticação feita com sucesso!",
          token: gerarTokenJWT(cpf, parsedEnv.JWT_SECRET),
        }),
      };
    } else {
      return {
        statusCode: 401,
        body: JSON.stringify({ mensagem: "Credenciais inválidas." }),
      };
    }
  } catch (err) {
    var mensagemDetalhe = "";
    if (err instanceof Error) {
      mensagemDetalhe = err.message;
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        mensagem: "Ocorreu um erro, tente novamente mais tarde",
        mensagemDetalhe: mensagemDetalhe,
      }),
    };
  }
};
