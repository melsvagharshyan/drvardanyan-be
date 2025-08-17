import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ServiceKey = 'consultation' | 'treatment' | 'extraction' | 'prosthetics';

@Schema({ timestamps: true })
export class Appointment extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phoneNumber: string;

  @Prop({ required: true, enum: ['consultation', 'treatment', 'extraction', 'prosthetics'] })
  service: ServiceKey;

  @Prop({ required: true })
  start: string; // ISO string

  @Prop({ required: true })
  end: string; // ISO string
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);


