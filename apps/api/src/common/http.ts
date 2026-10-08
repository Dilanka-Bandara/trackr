import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  createParamDecorator,
  ExceptionFilter,
  HttpException,
  Injectable,
  PipeTransform,
  SetMetadata,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { z, User } from '@trackr/shared';
import { Request, Response } from 'express';
export type AuthedRequest = Request & { user: User };
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx) => ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
type OpenApiSchema = NonNullable<
  Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema']
>;
export function Endpoint(summary: string, schema?: z.ZodType) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiResponse({ status: 400, description: 'Input validation failed' }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ...(schema
      ? [
          ApiBody({
            schema: z.toJSONSchema(schema, { io: 'input', target: 'openapi-3.0' }) as OpenApiSchema,
          }),
        ]
      : []),
  );
}
@Injectable()
export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}
  transform(value: unknown) {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    return parsed.data;
  }
}
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (status === 500) {
      Sentry.captureException(error);
      console.error(error);
    }
    const body = error instanceof HttpException ? error.getResponse() : null;
    const message =
      typeof body === 'object' && body && 'message' in body
        ? body.message
        : status === 500
          ? 'An unexpected error occurred'
          : body;
    response
      .status(status)
      .json({
        statusCode: status,
        message,
        error:
          status === 500 ? 'Internal Server Error' : error instanceof Error ? error.name : 'Error',
      });
  }
}
