import { WorkerStatus } from "../../generated/prisma/enums"


export class CreateWorkerDto {
    
    firstName: string

    lastName: string

    bio: string 

    avatarUrl: string | null

    baseRate: number

    status: WorkerStatus

    isOnline: Boolean

    homeBarangayId: string
}