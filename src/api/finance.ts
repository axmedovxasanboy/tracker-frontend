import { apiClient } from './client'
import type {
  DebtRequest, DebtResponse,
  LoanGivenRequest, LoanGivenResponse,
  LoanTakenRequest, LoanTakenResponse,
  BankLoanRequest, BankLoanResponse,
  MonthlyPaymentRequest, MonthlyPaymentResponse, MonthlyPaymentPayRequest,
  DonationRequest, DonationResponse,
  InvestmentRequest, InvestmentResponse,
  InvestmentContributeRequest, InvestmentValueRequest,
  RepaymentRequest,
  MarkPaidRequest, MarkPaidResponse,
  Transaction,
} from '../types'

const base = '/finance'

export const financeApi = {
  // Debts
  getDebts: () => apiClient.get<DebtResponse[]>(`${base}/debts`),
  createDebt: (d: DebtRequest) => apiClient.post<DebtResponse>(`${base}/debts`, d),
  updateDebt: (id: number, d: DebtRequest) => apiClient.put<DebtResponse>(`${base}/debts/${id}`, d),
  deleteDebt: (id: number) => apiClient.delete(`${base}/debts/${id}`),

  // Loans Given
  getLoansGiven: () => apiClient.get<LoanGivenResponse[]>(`${base}/loans-given`),
  createLoanGiven: (d: LoanGivenRequest) => apiClient.post<LoanGivenResponse>(`${base}/loans-given`, d),
  updateLoanGiven: (id: number, d: LoanGivenRequest) => apiClient.put<LoanGivenResponse>(`${base}/loans-given/${id}`, d),
  deleteLoanGiven: (id: number) => apiClient.delete(`${base}/loans-given/${id}`),

  // Loans Taken
  getLoansTaken: () => apiClient.get<LoanTakenResponse[]>(`${base}/loans-taken`),
  createLoanTaken: (d: LoanTakenRequest) => apiClient.post<LoanTakenResponse>(`${base}/loans-taken`, d),
  updateLoanTaken: (id: number, d: LoanTakenRequest) => apiClient.put<LoanTakenResponse>(`${base}/loans-taken/${id}`, d),
  deleteLoanTaken: (id: number) => apiClient.delete(`${base}/loans-taken/${id}`),

  // Bank Loans
  getBankLoans: () => apiClient.get<BankLoanResponse[]>(`${base}/bank-loans`),
  getBankNameSuggestions: (q?: string) =>
    apiClient.get<string[]>(`${base}/bank-loans/banks`, { params: { q: q ?? '' } }),
  createBankLoan: (d: BankLoanRequest) => apiClient.post<BankLoanResponse>(`${base}/bank-loans`, d),
  updateBankLoan: (id: number, d: BankLoanRequest) => apiClient.put<BankLoanResponse>(`${base}/bank-loans/${id}`, d),
  deleteBankLoan: (id: number) => apiClient.delete(`${base}/bank-loans/${id}`),

  // Monthly Payments
  getMonthlyPayments: () => apiClient.get<MonthlyPaymentResponse[]>(`${base}/monthly-payments`),
  createMonthlyPayment: (d: MonthlyPaymentRequest) => apiClient.post<MonthlyPaymentResponse>(`${base}/monthly-payments`, d),
  updateMonthlyPayment: (id: number, d: MonthlyPaymentRequest) => apiClient.put<MonthlyPaymentResponse>(`${base}/monthly-payments/${id}`, d),
  deleteMonthlyPayment: (id: number) => apiClient.delete(`${base}/monthly-payments/${id}`),
  payMonthlyPayment: (id: number, d: MonthlyPaymentPayRequest) =>
    apiClient.post<MonthlyPaymentResponse>(`${base}/monthly-payments/${id}/pay`, d),
  getMonthlyPaymentPayments: (id: number) =>
    apiClient.get<Transaction[]>(`${base}/monthly-payments/${id}/payments`),

  // Donations
  getDonations: () => apiClient.get<DonationResponse[]>(`${base}/donations`),
  createDonation: (d: DonationRequest) => apiClient.post<DonationResponse>(`${base}/donations`, d),
  updateDonation: (id: number, d: DonationRequest) => apiClient.put<DonationResponse>(`${base}/donations/${id}`, d),
  deleteDonation: (id: number) => apiClient.delete(`${base}/donations/${id}`),

  // Investments
  getInvestments: () => apiClient.get<InvestmentResponse[]>(`${base}/investments`),
  createInvestment: (d: InvestmentRequest) => apiClient.post<InvestmentResponse>(`${base}/investments`, d),
  updateInvestment: (id: number, d: InvestmentRequest) => apiClient.put<InvestmentResponse>(`${base}/investments/${id}`, d),
  deleteInvestment: (id: number) => apiClient.delete(`${base}/investments/${id}`),
  // Savings-goal / investment contribute + growth + history.
  contributeInvestment: (id: number, d: InvestmentContributeRequest) =>
    apiClient.post<InvestmentResponse>(`${base}/investments/${id}/contribute`, d),
  setInvestmentValue: (id: number, d: InvestmentValueRequest) =>
    apiClient.post<InvestmentResponse>(`${base}/investments/${id}/value`, d),
  getInvestmentContributions: (id: number) =>
    apiClient.get<Transaction[]>(`${base}/investments/${id}/contributions`),

  // Repayments
  repayLoanTaken: (id: number, d: RepaymentRequest) =>
    apiClient.post<LoanTakenResponse>(`${base}/loans-taken/${id}/repay`, d),
  repayDebt: (id: number, d: RepaymentRequest) =>
    apiClient.post<DebtResponse>(`${base}/debts/${id}/repay`, d),
  markLoanGivenReturned: (id: number, d: RepaymentRequest) =>
    apiClient.post<LoanGivenResponse>(`${base}/loans-given/${id}/mark-returned`, d),

  // "Already paid" — mark satisfied for the month with no transaction / money movement.
  markPaid: (d: MarkPaidRequest) =>
    apiClient.post<MarkPaidResponse>(`${base}/mark-paid`, d),

  // Payment history per loan/debt — newest first by transactionDate.
  getLoanTakenRepayments: (id: number) =>
    apiClient.get<Transaction[]>(`${base}/loans-taken/${id}/repayments`),
  getLoanGivenRepayments: (id: number) =>
    apiClient.get<Transaction[]>(`${base}/loans-given/${id}/repayments`),
  getDebtRepayments: (id: number) =>
    apiClient.get<Transaction[]>(`${base}/debts/${id}/repayments`),
}
