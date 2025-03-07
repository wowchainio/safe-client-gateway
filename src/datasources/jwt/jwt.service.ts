import { JwtClient } from '@/datasources/jwt/jwt.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { Algorithm } from 'jsonwebtoken';

@Injectable()
export class JwtService implements IJwtService {
  private static readonly ALGORITHM: Algorithm = 'HS256';

  issuer: string;
  secret: string;

  constructor(
    @Inject('JwtClient')
    private readonly client: JwtClient,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.issuer = configurationService.getOrThrow<string>('jwt.issuer');
    this.secret = configurationService.getOrThrow<string>('jwt.secret');
  }

  sign<
    T extends object & {
      iat?: Date;
      exp?: Date;
      nbf?: Date;
    },
  >(
    payload: T,
    options: { secretOrPrivateKey: string; algorithm?: Algorithm } = {
      secretOrPrivateKey: this.secret,
    },
  ): string {
    return this.client.sign(
      {
        iss: 'iss' in payload ? payload.iss : this.issuer,
        ...payload,
      },
      { ...options, algorithm: options.algorithm ?? JwtService.ALGORITHM },
    );
  }

  verify<T extends object>(
    token: string,
    options: {
      issuer: string;
      secretOrPrivateKey: string;
      algorithms?: Array<Algorithm>;
    } = {
      issuer: this.issuer,
      secretOrPrivateKey: this.secret,
    },
  ): T {
    return this.client.verify(token, options);
  }

  decode<T extends object>(
    token: string,
    options: {
      issuer: string;
      secretOrPrivateKey: string;
      algorithms?: Array<Algorithm>;
    } = {
      issuer: this.issuer,
      secretOrPrivateKey: this.secret,
    },
  ): JwtPayloadWithClaims<T> {
    return this.client.decode(token, options);
  }
}
