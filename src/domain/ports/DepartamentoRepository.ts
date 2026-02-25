import type { Departamento } from '../entities/Departamento';

export interface DepartamentoRepository {
  findAll(): Promise<Departamento[]>;
}
