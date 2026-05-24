const IS_PROD = process.env.NODE_ENV === "production";

const logError = (err, req) => {
  const entry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    status: err.status || 500,
    message: err.message,
    ...(err.code && { prismaCode: err.code }),
    ...(!IS_PROD && err.stack && { stack: err.stack }),
  };

  if ((err.status || 500) >= 500) {
    console.error("[ERROR]", JSON.stringify(entry));
  } else {
    console.warn("[WARN]", JSON.stringify(entry));
  }
};

const errorHandler = (err, req, res, next) => {
  if (err.constructor.name === "PrismaClientValidationError") {
    logError(err, req);
    return res.status(400).json({
      success: false,
      error: "Invalid data sent to database",
    });
  }

  if (err.constructor.name === "PrismaClientKnownRequestError") {
    logError(err, req);
    switch (err.code) {
      case "P2025":
        if (err.meta?.cause?.includes("nested connect")) {
          const model =
            err.meta.cause.match(/No '(\w+)' record/)?.[1] ?? "record";
          return res.status(422).json({
            success: false,
            error: `Referenced ${model} does not exist`,
          });
        }
        return res
          .status(404)
          .json({ success: false, error: "Record not found" });
      case "P2003":
        return res.status(422).json({
          success: false,
          error: `Referenced ${err.meta?.field_name ?? "record"} does not exist`,
        });
      case "P2002":
        return res.status(422).json({
          success: false,
          error: "A record with this value already exists",
        });
      case "P2014":
        return res.status(422).json({
          success: false,
          error: "Operation would violate a required relation",
        });
      case "P2011":
        return res
          .status(422)
          .json({ success: false, error: "A required field was sent as null" });
      case "P2006":
        return res.status(422).json({
          success: false,
          error: "Invalid value provided for a field",
        });
    }
  }

  const status = err.status || 500;

  const message =
    IS_PROD && status === 500
      ? "Internal Server Error"
      : err.message || "Internal Server Error";

  logError(err, req);

  res.status(status).json({
    success: false,
    error: message,
  });
};

module.exports = errorHandler;