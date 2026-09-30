import {DESCOMPLICANDO_SPEAKER_PHOTO} from '../shared-defaults';
import type {DescomplicandoSpeakerProps} from './types';

export function createDefaultDescomplicandoSpeaker(): DescomplicandoSpeakerProps {
  return {
    imageSrc: DESCOMPLICANDO_SPEAKER_PHOTO,
    imageAlt: 'Karina Luiza dos Santos Azevedo',
    eyebrow: 'Nossa convidada da noite',
    name: 'Karina Luiza dos Santos Azevedo',
    bio: 'Educadora com formação em Pedagogia, especialista em Inovação Educacional e mestranda em Ensino de Computação pela UFRPE. Professora da rede municipal na correção de fluxo e apoio pedagógico, foi vencedora do edital Professor Inovador em 2024 e 2025. Entusiasta da educação ‘fora da caixa’, dedica-se a traduzir conceitos complexos da tecnologia para a realidade da sala de aula. Sua atuação e pesquisa focam no letramento digital e no uso ético de algoritmos e IA, transformando ferramentas digitais em espaços de autoria e inclusão por meio de metodologias ativas. Acredita que descomplicar a tecnologia é o primeiro passo para uma educação verdadeiramente emancipatória, protagonista e inovadora.',
  };
}
