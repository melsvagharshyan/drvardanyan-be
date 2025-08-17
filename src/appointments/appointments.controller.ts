import { Body, Controller, Get, Post, Delete, Param, Query, Patch } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import type { ServiceKey } from './schema/appointment.schema';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // Get all appointments
  @Get()
  async getAllAppointments() {
    return this.appointmentsService.getAllAppointments();
  }

  // Returns available slots for a given date (YYYY-MM-DD)
  @Get('availability')
  async getAvailability(
    @Query('date') date: string,
    @Query('service') service?: ServiceKey,
    @Query('tzOffset') tzOffset?: string,
  ): Promise<{
    availableSlots: string[];
    busySlots: string[];
    workingSlots: string[];
  }> {
    const tzOffsetMinutes = tzOffset !== undefined ? Number(tzOffset) : undefined;
    const { availableSlots, busySlots, workingSlots } =
      await this.appointmentsService.getAvailabilityForDate(date, service, tzOffsetMinutes);
    return { availableSlots, busySlots, workingSlots };
  }

  // Create a booking. Body should contain: name, phoneNumber, service, start (ISO string)
  @Post()
  async createAppointment(
    @Body()
    body: {
      name: string;
      phoneNumber: string;
      service: 'consultation' | 'treatment' | 'extraction' | 'prosthetics';
      start: string; // ISO
      tzOffset?: number; // minutes from Date.getTimezoneOffset()
    },
  ) {
    return this.appointmentsService.createAppointment(body);
  }

  // Update an appointment by ID
  @Patch(':id')
  async updateAppointment(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      phoneNumber?: string;
      service?: 'consultation' | 'treatment' | 'extraction' | 'prosthetics';
      start?: string; // ISO
      tzOffset?: number; // minutes from Date.getTimezoneOffset()
    },
  ) {
    return this.appointmentsService.updateAppointment(id, body);
  }

  // Delete an appointment by ID
  @Delete(':id')
  async deleteAppointment(@Param('id') id: string) {
    return this.appointmentsService.deleteAppointment(id);
  }
}
