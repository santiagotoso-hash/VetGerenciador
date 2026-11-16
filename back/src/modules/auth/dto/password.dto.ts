import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail() email: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(20) @MaxLength(200) token: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres' })
  @MaxLength(100)
  @Matches(/[A-Za-z]/, { message: 'A senha deve ter pelo menos uma letra' })
  @Matches(/\d/, { message: 'A senha deve ter pelo menos um número' })
  password: string;
}
