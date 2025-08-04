import { Body, Controller, Post } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { Messages } from './schema/messages.schema';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}
  @Post()
  sendMessage(@Body() body: Messages) {
    return this.messagesService.sendMessage(body);
  }
}
