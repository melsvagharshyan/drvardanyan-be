import { Messages } from './schema/messages.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Messages.name) private readonly messagesModel: Model<Messages>,
  ) {}
  sendMessage(dto: Messages) {
    return this.messagesModel.create(dto);
  }
}
