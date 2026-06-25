import { PartialType } from "@nestjs/mapped-types";
import { CreateWorkerDto } from "@/modules/workers/dto/create-worker.dto";


export class UpdateWorkerDto extends PartialType(CreateWorkerDto) {}