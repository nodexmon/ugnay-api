import { AuthJwtPayload } from "../../auth/auth.types";

declare global {
    namespace Express {
        interface Request {
            user?: AuthJwtPayload
        }
    }
}