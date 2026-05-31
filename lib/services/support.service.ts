import { SupportRepository, CreateSupportTicketData, UpdateSupportTicketData, CreateSupportTicketMessageData } from '@/lib/repositories/support.repository';

export class SupportService {
  private repo = new SupportRepository();

  async createTicket(dto: CreateSupportTicketData) {
    try {
      const ticket = await this.repo.createTicket(dto);
      return {
        success: true,
        message: 'Support ticket created successfully',
        data: ticket,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create support ticket',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listTickets(page?: number, limit?: number) {
    try {
      const result = await this.repo.listTickets(page, limit);
      return {
        success: true,
        message: 'Support tickets retrieved successfully',
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve support tickets',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getTicket(id: string) {
    try {
      const data = await this.repo.getTicket(id);
      if (!data) {
        return {
          success: false,
          message: 'Ticket not found',
        };
      }
      return {
        success: true,
        message: 'Support ticket retrieved successfully',
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve support ticket',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateTicket(id: string, dto: UpdateSupportTicketData) {
    try {
      const existing = await this.repo.getTicket(id);
      if (!existing) {
        return {
          success: false,
          message: 'Ticket not found',
        };
      }
      const ticket = await this.repo.updateTicket(id, dto);
      return {
        success: true,
        message: 'Support ticket updated successfully',
        data: ticket,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update support ticket',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteTicket(id: string) {
    try {
      const existing = await this.repo.getTicket(id);
      if (!existing) {
        return {
          success: false,
          message: 'Ticket not found',
        };
      }
      await this.repo.deleteTicket(id);
      return {
        success: true,
        message: 'Support ticket deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete support ticket',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async addMessage(dto: CreateSupportTicketMessageData) {
    try {
      const message = await this.repo.addMessage(dto);
      return {
        success: true,
        message: 'Message added successfully',
        data: message,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add message',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listMessages(ticketId: string) {
    try {
      const messages = await this.repo.listMessages(ticketId);
      return {
        success: true,
        message: 'Messages retrieved successfully',
        data: messages,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve messages',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}







































