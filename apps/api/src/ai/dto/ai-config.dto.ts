import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, IsEnum } from 'class-validator';

export enum AIProviderDto {
  OPENAI = 'OPENAI',
  GROQ = 'GROQ',
  GEMINI = 'GEMINI',
}

export class AIConfigDto {
  @IsOptional()
  @IsEnum(AIProviderDto)
  provider?: AIProviderDto;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  personality?: string;

  @IsOptional()
  @IsString()
  toneOfVoice?: string;

  @IsOptional()
  @IsArray()
  rules?: string[];

  @IsOptional()
  @IsArray()
  faq?: { question: string; answer: string }[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  dailyTokenLimit?: number;

  @IsOptional()
  @IsNumber()
  monthlyTokenLimit?: number;

  @IsOptional()
  @IsString()
  allowedHoursStart?: string;

  @IsOptional()
  @IsString()
  allowedHoursEnd?: string;
}

export class TestKeyDto {
  @IsEnum(AIProviderDto)
  provider: AIProviderDto;

  @IsString()
  apiKey: string;
}

export const AI_MODELS: Record<AIProviderDto, { id: string; name: string }[]> = {
  [AIProviderDto.OPENAI]: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Rápido e econômico)' },
    { id: 'gpt-4o', name: 'GPT-4o (Mais inteligente)' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Mais barato)' },
  ],
  [AIProviderDto.GROQ]: [
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Ultra rápido)' },
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Versátil)' },
    { id: 'llama3-70b-8192', name: 'Llama 3 70B' },
    { id: 'llama3-8b-8192', name: 'Llama 3 8B (Rápido)' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
  ],
  [AIProviderDto.GEMINI]: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Mais novo, rápido e inteligente)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Rápido)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Mais inteligente)' },
    { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
  ],
};
